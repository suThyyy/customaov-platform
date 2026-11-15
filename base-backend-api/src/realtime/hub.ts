import { randomUUID, timingSafeEqual } from "node:crypto";
import {
  WsClientMessageSchema,
  type ChatMessage,
  type ErrorCode,
  type RoomCode,
  type WsServerMessage,
} from "@customaov/contracts";
import { and, eq } from "drizzle-orm";
import type { FastifyBaseLogger } from "fastify";

import type { DbClient } from "../db/client.js";
import { roomMembers, rooms } from "../db/schema.js";
import { RoomServiceError, getRoomDetail } from "../services/rooms.js";

export const MAX_GUEST_CONNECTIONS_PER_IP = 5;
export const MAX_SUBSCRIPTIONS_PER_CONNECTION = 20;
export const WS_PING_INTERVAL_MS = 25_000;
const WS_OPEN_READY_STATE = 1;

export type WsRawData = string | Buffer | ArrayBuffer | Buffer[];

export interface RealtimeSocket {
  readonly readyState: number;
  send(data: string): void;
  ping(): void;
  close(code?: number, reason?: string): void;
  terminate(): void;
  on(event: "message", listener: (data: WsRawData, isBinary: boolean) => void): unknown;
  on(event: "pong", listener: () => void): unknown;
  on(event: "close", listener: () => void): unknown;
  on(event: "error", listener: (err: Error) => void): unknown;
}

export type RealtimeEvent =
  | { type: "room.changed"; code: string }
  | { type: "chat.message"; code: string; message: ChatMessage }
  | { type: "room.kicked"; code: string; userId: string };

/**
 * Pub/sub transport abstraction for room realtime events.
 * MVP uses an in-memory single-process bus; can be replaced with Redis/external
 * pub/sub later without changing the hub or REST route hooks.
 */
export interface RealtimeBus {
  publish(event: RealtimeEvent): void;
  subscribe(listener: (event: RealtimeEvent) => void): () => void;
  close?(): Promise<void> | void;
}

export class InMemoryRealtimeBus implements RealtimeBus {
  private readonly listeners = new Set<(event: RealtimeEvent) => void>();

  publish(event: RealtimeEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  subscribe(listener: (event: RealtimeEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  close(): void {
    this.listeners.clear();
  }
}

export interface RoomRealtimePublisher {
  notifyRoomChanged(code: string): void;
  notifyChatMessage(code: string, message: ChatMessage): void;
  notifyRoomKicked(code: string, userId: string): void;
}

export interface RoomRealtimeHubOptions {
  db: DbClient;
  bus?: RealtimeBus;
  logger?: FastifyBaseLogger;
  maxGuestConnectionsPerIp?: number;
  maxSubscriptionsPerConnection?: number;
  pingIntervalMs?: number;
}

export interface ConnectionContext {
  userId: string | null;
  ip: string;
}

interface SubscriptionEntry {
  key?: string;
}

interface ConnectionState {
  id: string;
  socket: RealtimeSocket;
  userId: string | null;
  ip: string;
  isAlive: boolean;
  closed: boolean;
  subscriptions: Map<string, SubscriptionEntry>;
  messageQueue: Promise<void>;
  cleanup: () => void;
}

function keysMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

function rawDataToString(data: WsRawData): string {
  if (typeof data === "string") return data;
  if (Buffer.isBuffer(data)) return data.toString("utf8");
  if (Array.isArray(data)) return Buffer.concat(data).toString("utf8");
  return Buffer.from(data).toString("utf8");
}

export interface RoomRealtimeHub extends RoomRealtimePublisher {
  canAcceptGuest(ip: string): boolean;
  handleConnection(socket: RealtimeSocket, context: ConnectionContext): void;
  close(): Promise<void>;
}

export function createRoomRealtimeHub(
  options: RoomRealtimeHubOptions,
): RoomRealtimeHub {
  const { db, logger } = options;
  const bus = options.bus ?? new InMemoryRealtimeBus();
  const maxGuestConnectionsPerIp =
    options.maxGuestConnectionsPerIp ?? MAX_GUEST_CONNECTIONS_PER_IP;
  const maxSubscriptionsPerConnection =
    options.maxSubscriptionsPerConnection ?? MAX_SUBSCRIPTIONS_PER_CONNECTION;
  const pingIntervalMs = options.pingIntervalMs ?? WS_PING_INTERVAL_MS;

  const connections = new Map<string, ConnectionState>();
  const subscribersByRoom = new Map<string, Set<string>>();
  const guestCountByIp = new Map<string, number>();
  const roomQueues = new Map<string, Promise<void>>();
  let isClosing = false;

  const sendMessage = (conn: ConnectionState, message: WsServerMessage): void => {
    if (conn.closed || conn.socket.readyState !== WS_OPEN_READY_STATE) {
      return;
    }
    try {
      conn.socket.send(JSON.stringify(message));
    } catch (err) {
      logger?.warn({ err, connectionId: conn.id }, "Failed to send WebSocket message");
      conn.cleanup();
    }
  };

  const sendError = (
    conn: ConnectionState,
    code: ErrorCode,
    room?: RoomCode,
  ): void => {
    sendMessage(
      conn,
      room !== undefined
        ? { type: "error", code, room }
        : { type: "error", code },
    );
  };

  const removeSubscription = (conn: ConnectionState, code: string): void => {
    conn.subscriptions.delete(code);
    const roomSet = subscribersByRoom.get(code);
    if (!roomSet) return;
    roomSet.delete(conn.id);
    if (roomSet.size === 0) {
      subscribersByRoom.delete(code);
    }
  };

  const enqueueRoomTask = (code: string, task: () => Promise<void>): void => {
    const previous = roomQueues.get(code) ?? Promise.resolve();
    const next = previous
      .then(task)
      .catch((err) => {
        logger?.error({ err, roomCode: code }, "Realtime room broadcast failed");
      })
      .finally(() => {
        if (roomQueues.get(code) === next) {
          roomQueues.delete(code);
        }
      });
    roomQueues.set(code, next);
  };

  const handleSubscribe = async (
    conn: ConnectionState,
    code: RoomCode,
    key?: string,
  ): Promise<void> => {
    if (conn.closed) return;

    const alreadySubscribed = conn.subscriptions.has(code);
    if (!alreadySubscribed && conn.subscriptions.size >= maxSubscriptionsPerConnection) {
      sendError(conn, "RATE_LIMITED", code);
      return;
    }

    const [room] = await db
      .select({
        id: rooms.id,
        visibility: rooms.visibility,
        joinKey: rooms.joinKey,
      })
      .from(rooms)
      .where(eq(rooms.code, code))
      .limit(1);

    if (conn.closed) return;

    if (!room) {
      sendError(conn, "NOT_FOUND", code);
      return;
    }

    if (room.visibility === "private") {
      let allowed = keysMatch(key, room.joinKey);
      if (!allowed && conn.userId) {
        const [member] = await db
          .select({ userId: roomMembers.userId })
          .from(roomMembers)
          .where(
            and(
              eq(roomMembers.roomId, room.id),
              eq(roomMembers.userId, conn.userId),
              eq(roomMembers.active, true),
            ),
          )
          .limit(1);
        allowed = Boolean(member);
      }

      if (conn.closed) return;

      if (!allowed) {
        sendError(conn, "FORBIDDEN", code);
        return;
      }
    }

    if (
      !conn.subscriptions.has(code) &&
      conn.subscriptions.size >= maxSubscriptionsPerConnection
    ) {
      sendError(conn, "RATE_LIMITED", code);
      return;
    }

    conn.subscriptions.set(code, key !== undefined ? { key } : {});
    let roomSet = subscribersByRoom.get(code);
    if (!roomSet) {
      roomSet = new Set();
      subscribersByRoom.set(code, roomSet);
    }
    roomSet.add(conn.id);
  };

  const handleIncomingRaw = async (
    conn: ConnectionState,
    data: WsRawData,
    isBinary: boolean,
  ): Promise<void> => {
    if (conn.closed) return;
    if (isBinary) {
      sendError(conn, "VALIDATION");
      return;
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawDataToString(data));
    } catch {
      sendError(conn, "VALIDATION");
      return;
    }

    const parsed = WsClientMessageSchema.safeParse(parsedJson);
    if (!parsed.success) {
      sendError(conn, "VALIDATION");
      return;
    }

    const msg = parsed.data;
    if (msg.type === "unsubscribe") {
      removeSubscription(conn, msg.room);
      return;
    }

    await handleSubscribe(conn, msg.room, msg.key);
  };

  const processRoomChanged = async (code: string): Promise<void> => {
    const subscriberIds = [...(subscribersByRoom.get(code) ?? [])];
    if (subscriberIds.length === 0) return;

    for (const connId of subscriberIds) {
      const conn = connections.get(connId);
      const sub = conn?.subscriptions.get(code);
      if (!conn || !sub || conn.closed) continue;

      try {
        const detail = await getRoomDetail(db, code, conn.userId, sub.key);
        if (!conn.closed && conn.subscriptions.has(code)) {
          sendMessage(conn, { type: "room.updated", room: detail });
        }
      } catch (err) {
        if (err instanceof RoomServiceError && err.code === "NOT_FOUND") {
          return;
        }
        logger?.warn(
          { err, roomCode: code, connectionId: connId },
          "Failed to build room.updated payload",
        );
      }
    }
  };

  const processChatMessage = async (
    code: string,
    message: ChatMessage,
  ): Promise<void> => {
    const subscriberIds = [...(subscribersByRoom.get(code) ?? [])];
    if (subscriberIds.length === 0) return;

    const hasUserSubscriber = subscriberIds.some((connId) => {
      const conn = connections.get(connId);
      return Boolean(conn && !conn.closed && conn.userId !== null);
    });
    if (!hasUserSubscriber) return;

    const [room] = await db
      .select({ id: rooms.id })
      .from(rooms)
      .where(eq(rooms.code, code))
      .limit(1);
    if (!room) return;

    const activeMembers = await db
      .select({ userId: roomMembers.userId })
      .from(roomMembers)
      .where(and(eq(roomMembers.roomId, room.id), eq(roomMembers.active, true)));
    const activeMemberIds = new Set(activeMembers.map((m) => m.userId));

    for (const connId of subscriberIds) {
      const conn = connections.get(connId);
      if (!conn || conn.closed || !conn.userId) continue;
      if (!conn.subscriptions.has(code)) continue;
      if (!activeMemberIds.has(conn.userId)) continue;
      sendMessage(conn, {
        type: "chat.message",
        room: code as RoomCode,
        message,
      });
    }
  };

  const processRoomKicked = async (code: string, userId: string): Promise<void> => {
    const subscriberIds = [...(subscribersByRoom.get(code) ?? [])];
    for (const connId of subscriberIds) {
      const conn = connections.get(connId);
      if (!conn || conn.closed || conn.userId !== userId) continue;
      if (!conn.subscriptions.has(code)) continue;
      sendMessage(conn, { type: "room.kicked", room: code as RoomCode });
      removeSubscription(conn, code);
    }
  };

  const unsubscribeBus = bus.subscribe((event) => {
    if (isClosing) return;
    switch (event.type) {
      case "room.changed":
        enqueueRoomTask(event.code, () => processRoomChanged(event.code));
        break;
      case "chat.message":
        enqueueRoomTask(event.code, () =>
          processChatMessage(event.code, event.message),
        );
        break;
      case "room.kicked":
        enqueueRoomTask(event.code, () =>
          processRoomKicked(event.code, event.userId),
        );
        break;
    }
  });

  const heartbeatTimer = setInterval(() => {
    for (const conn of connections.values()) {
      if (conn.closed) continue;
      if (!conn.isAlive) {
        logger?.debug({ connectionId: conn.id }, "Closing unresponsive WebSocket");
        conn.cleanup();
        try {
          conn.socket.terminate();
        } catch {
          // Ignore errors when terminating dead socket.
        }
        continue;
      }
      conn.isAlive = false;
      try {
        conn.socket.ping();
      } catch {
        conn.cleanup();
      }
    }
  }, pingIntervalMs);
  heartbeatTimer.unref?.();

  const canAcceptGuest = (ip: string): boolean => {
    return (guestCountByIp.get(ip) ?? 0) < maxGuestConnectionsPerIp;
  };

  const handleConnection = (
    socket: RealtimeSocket,
    context: ConnectionContext,
  ): void => {
    if (isClosing) {
      socket.close(1001, "Server shutting down");
      return;
    }

    const isGuest = context.userId === null;
    if (isGuest && !canAcceptGuest(context.ip)) {
      socket.close(1008, "Too many guest connections");
      return;
    }

    if (isGuest) {
      guestCountByIp.set(context.ip, (guestCountByIp.get(context.ip) ?? 0) + 1);
    }

    const id = randomUUID();
    const conn: ConnectionState = {
      id,
      socket,
      userId: context.userId,
      ip: context.ip,
      isAlive: true,
      closed: false,
      subscriptions: new Map(),
      messageQueue: Promise.resolve(),
      cleanup: () => {
        if (conn.closed) return;
        conn.closed = true;
        connections.delete(conn.id);
        for (const code of [...conn.subscriptions.keys()]) {
          removeSubscription(conn, code);
        }
        if (isGuest) {
          const nextCount = (guestCountByIp.get(conn.ip) ?? 1) - 1;
          if (nextCount <= 0) {
            guestCountByIp.delete(conn.ip);
          } else {
            guestCountByIp.set(conn.ip, nextCount);
          }
        }
      },
    };

    connections.set(id, conn);

    socket.on("pong", () => {
      conn.isAlive = true;
    });

    socket.on("message", (data, isBinary) => {
      conn.messageQueue = conn.messageQueue
        .then(() => handleIncomingRaw(conn, data, isBinary))
        .catch((err) => {
          logger?.warn(
            { err, connectionId: conn.id },
            "Unhandled WebSocket message error",
          );
        });
    });

    socket.on("close", () => {
      conn.cleanup();
    });

    socket.on("error", (err) => {
      logger?.debug({ err, connectionId: conn.id }, "WebSocket socket error");
      conn.cleanup();
    });
  };

  return {
    canAcceptGuest,
    handleConnection,
    notifyRoomChanged(code: string) {
      bus.publish({ type: "room.changed", code });
    },
    notifyChatMessage(code: string, message: ChatMessage) {
      bus.publish({ type: "chat.message", code, message });
    },
    notifyRoomKicked(code: string, userId: string) {
      bus.publish({ type: "room.kicked", code, userId });
    },
    async close() {
      isClosing = true;
      clearInterval(heartbeatTimer);
      unsubscribeBus();
      for (const conn of [...connections.values()]) {
        conn.cleanup();
        try {
          conn.socket.close(1001, "Server shutting down");
        } catch {
          // Ignore errors on close.
        }
      }
      await Promise.allSettled([...roomQueues.values()]);
      roomQueues.clear();
      await bus.close?.();
    },
  };
}
