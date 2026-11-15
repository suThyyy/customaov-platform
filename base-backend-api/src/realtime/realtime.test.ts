import { EventEmitter } from "node:events";
import {
  ChatMessageSchema,
  RoomDetailSchema,
  WsServerMessageSchema,
  type WsServerMessage,
} from "@customaov/contracts";
import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { loadConfig, type AppConfig } from "../config.js";
import { closeDb, type DbClient } from "../db/client.js";
import { createRoomRealtimeHub, type RealtimeSocket } from "./hub.js";
import {
  createLoggedInClients,
  createTestDb,
  type TestClient,
} from "../test/helpers.js";

const VALID_CONFIG = {
  format: "5v5" as const,
  pickMode: "draft" as const,
  series: "BO1" as const,
  tools: ["balance", "lane", "chat"] as Array<
    "balance" | "lane" | "champion" | "mystery" | "chat"
  >,
  notes: "Realtime test",
};

interface TestServer {
  app: ReturnType<typeof buildApp>;
  db: DbClient;
  wsUrl: string;
  sockets: WebSocket[];
  close(): Promise<void>;
}

let current: TestServer | undefined;

afterEach(async () => {
  await current?.close();
  current = undefined;
});

async function startTestServer(
  envOverrides: Record<string, string> = {},
): Promise<TestServer> {
  const config: AppConfig = loadConfig({
    NODE_ENV: "test",
    LOG_LEVEL: "silent",
    ...envOverrides,
  });
  const db = await createTestDb();
  const app = buildApp({ config, db, logger: false });
  await app.listen({ host: "127.0.0.1", port: 0 });
  const address = app.server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected numeric listen address");
  }
  const wsUrl = `ws://127.0.0.1:${address.port}/api/ws`;
  const sockets: WebSocket[] = [];

  const server: TestServer = {
    app,
    db,
    wsUrl,
    sockets,
    async close() {
      for (const ws of sockets) {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      }
      await app.close();
      await closeDb(db);
    },
  };
  current = server;
  return server;
}

class WsClientWrapper {
  readonly messages: WsServerMessage[] = [];
  private waiters: Array<{
    predicate: (msg: WsServerMessage) => boolean;
    resolve: (msg: WsServerMessage) => void;
    reject: (err: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }> = [];
  private closed = false;

  constructor(readonly ws: WebSocket) {
    ws.addEventListener("message", (event) => {
      const parsed = WsServerMessageSchema.parse(JSON.parse(String(event.data)));
      const idx = this.waiters.findIndex((w) => w.predicate(parsed));
      if (idx !== -1) {
        const waiter = this.waiters.splice(idx, 1)[0]!;
        clearTimeout(waiter.timer);
        waiter.resolve(parsed);
        return;
      }
      this.messages.push(parsed);
    });
    ws.addEventListener("close", () => {
      this.closed = true;
      for (const waiter of this.waiters.splice(0)) {
        clearTimeout(waiter.timer);
        waiter.reject(new Error("WebSocket closed while waiting for message"));
      }
    });
  }

  send(payload: unknown): void {
    this.ws.send(JSON.stringify(payload));
  }

  nextMessage(
    predicate: (msg: WsServerMessage) => boolean = () => true,
    timeoutMs = 3000,
  ): Promise<WsServerMessage> {
    const existingIdx = this.messages.findIndex(predicate);
    if (existingIdx !== -1) {
      return Promise.resolve(this.messages.splice(existingIdx, 1)[0]!);
    }
    if (this.closed) {
      return Promise.reject(new Error("WebSocket already closed"));
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const i = this.waiters.findIndex((w) => w.resolve === resolve);
        if (i !== -1) this.waiters.splice(i, 1);
        reject(new Error(`Timed out after ${timeoutMs}ms waiting for WS message`));
      }, timeoutMs);
      this.waiters.push({ predicate, resolve, reject, timer });
    });
  }

  async expectNoMessage(delayMs = 150): Promise<void> {
    await new Promise((r) => setTimeout(r, delayMs));
    expect(this.messages).toHaveLength(0);
  }
}

function createNodeWs(
  url: string,
  headers?: Record<string, string>,
): WebSocket {
  const NodeWebSocket = WebSocket as unknown as new (
    url: string,
    opts?: { headers?: Record<string, string> },
  ) => WebSocket;
  return headers ? new NodeWebSocket(url, { headers }) : new NodeWebSocket(url);
}

async function openWs(
  server: TestServer,
  opts: { client?: TestClient; origin?: string } = {},
): Promise<WsClientWrapper> {
  const headers: Record<string, string> = {};
  if (opts.client && opts.client.cookies.size > 0) {
    headers.cookie = opts.client.cookieHeader();
  }
  if (opts.origin !== undefined) {
    headers.origin = opts.origin;
  }

  const ws = createNodeWs(
    server.wsUrl,
    Object.keys(headers).length > 0 ? headers : undefined,
  );
  server.sockets.push(ws);

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("WS open timeout")), 3000);
    ws.addEventListener(
      "open",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
    ws.addEventListener(
      "error",
      () => {
        clearTimeout(timer);
        reject(new Error("WebSocket handshake rejected"));
      },
      { once: true },
    );
  });

  return new WsClientWrapper(ws);
}

async function expectWsRejected(
  url: string,
  headers?: Record<string, string>,
): Promise<void> {
  const ws = createNodeWs(url, headers);
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error("Expected WS rejection but timed out"));
    }, 3000);
    ws.addEventListener(
      "open",
      () => {
        clearTimeout(timer);
        ws.close();
        reject(new Error("Expected WS handshake to be rejected, but it opened"));
      },
      { once: true },
    );
    ws.addEventListener(
      "error",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

describe("room realtime WebSocket (/api/ws)", () => {
  it("checks Origin: rejects foreign origin and missing origin in production", async () => {
    const devServer = await startTestServer({
      ALLOWED_ORIGINS: "http://localhost:5174",
    });

    // Missing Origin allowed in non-production
    const okDev = await openWs(devServer);
    okDev.ws.close();

    // Foreign Origin rejected
    await expectWsRejected(devServer.wsUrl, { origin: "https://evil.example" });
    await devServer.close();
    current = undefined;

    // Production: missing Origin rejected, allowed Origin accepted
    const prodServer = await startTestServer({
      NODE_ENV: "production",
      CSRF_SECRET: "production-secret-at-least-16-chars",
      ALLOWED_ORIGINS: "https://app.customaov.test",
    });

    await expectWsRejected(prodServer.wsUrl);
    await expectWsRejected(prodServer.wsUrl, { origin: "https://evil.example" });
    const okProd = await openWs(prodServer, {
      origin: "https://app.customaov.test",
    });
    okProd.ws.close();
  });

  it("enforces public vs private subscribe rules and validates client messages", async () => {
    const server = await startTestServer();
    const [hostPub, hostPriv, member, outsider] = await createLoggedInClients(
      server.app,
      4,
      "ws_priv",
    );

    const publicRoom = RoomDetailSchema.parse(
      (
        await hostPub!.client.request("POST", "/api/rooms", {
          payload: {
            title: "Phòng công khai",
            mode: "normal",
            visibility: "public",
            config: VALID_CONFIG,
          },
        })
      ).json(),
    );

    const privRes = await hostPriv!.client.request("POST", "/api/rooms", {
      payload: {
        title: "Phòng riêng tư",
        mode: "normal",
        visibility: "private",
        config: VALID_CONFIG,
      },
    });
    const privRoom = RoomDetailSchema.parse(privRes.json());
    const joinKey = new URLSearchParams(privRoom.shareUrl!.split("?")[1]).get(
      "key",
    )!;
    expect(joinKey).toBeTruthy();

    await member!.client.request("POST", `/api/rooms/${privRoom.code}/join`, {
      payload: { as: "player", key: joinKey },
    });

    const guestWs = await openWs(server);
    const outsiderWs = await openWs(server, { client: outsider!.client });
    const memberWs = await openWs(server, { client: member!.client });

    // Malformed JSON and invalid schema -> VALIDATION
    guestWs.ws.send("{not-json");
    expect(await guestWs.nextMessage()).toEqual({
      type: "error",
      code: "VALIDATION",
    });

    guestWs.send({ type: "ping" });
    expect(await guestWs.nextMessage()).toEqual({
      type: "error",
      code: "VALIDATION",
    });

    // Non-existent room -> NOT_FOUND
    guestWs.send({ type: "subscribe", room: "AOV-999999" });
    expect(await guestWs.nextMessage()).toEqual({
      type: "error",
      code: "NOT_FOUND",
      room: "AOV-999999",
    });

    // Guest subscribing to public room -> OK (receives update when room changes)
    guestWs.send({ type: "subscribe", room: publicRoom.code });
    await guestWs.expectNoMessage();

    // Private room without key -> FORBIDDEN, and not registered
    guestWs.send({ type: "subscribe", room: privRoom.code });
    expect(await guestWs.nextMessage()).toEqual({
      type: "error",
      code: "FORBIDDEN",
      room: privRoom.code,
    });

    outsiderWs.send({ type: "subscribe", room: privRoom.code, key: "wrong-key" });
    expect(await outsiderWs.nextMessage()).toEqual({
      type: "error",
      code: "FORBIDDEN",
      room: privRoom.code,
    });

    // Private room with valid key -> OK; member without key -> OK
    outsiderWs.send({ type: "subscribe", room: privRoom.code, key: joinKey });
    memberWs.send({ type: "subscribe", room: privRoom.code });
    await outsiderWs.expectNoMessage();
    await memberWs.expectNoMessage();

    // Trigger change in private room
    await member!.client.request("PATCH", `/api/rooms/${privRoom.code}/me`, {
      payload: { ready: true },
    });

    const outsiderUpdate = await outsiderWs.nextMessage();
    expect(outsiderUpdate.type).toBe("room.updated");
    if (outsiderUpdate.type === "room.updated") {
      expect(outsiderUpdate.room.restricted).toBe(false);
      if (!outsiderUpdate.room.restricted) {
        expect(outsiderUpdate.room.myRole).toBeNull();
        expect(outsiderUpdate.room.shareUrl).toBeUndefined();
      }
    }

    const memberUpdate = await memberWs.nextMessage();
    expect(memberUpdate.type).toBe("room.updated");
    if (memberUpdate.type === "room.updated" && !memberUpdate.room.restricted) {
      expect(memberUpdate.room.myRole).toBe("player");
      expect(memberUpdate.room.shareUrl).toBeUndefined();
    }

    // Guest was NOT subscribed to private room -> gets nothing
    await guestWs.expectNoMessage();

    // Trigger change in public room -> guest receives update
    await hostPub!.client.request("POST", `/api/rooms/${publicRoom.code}/random-lanes`);
    const pubUpdate = await guestWs.nextMessage();
    expect(pubUpdate.type).toBe("room.updated");
    if (pubUpdate.type === "room.updated") {
      expect(pubUpdate.room.code).toBe(publicRoom.code);
    }
  });

  it("broadcasts per-recipient room.updated on join/split (shareUrl only for host) and restricted view after leaving private room", async () => {
    const server = await startTestServer();
    const clients = await createLoggedInClients(server.app, 10, "ws_split");
    const host = clients[0]!;
    const p2 = clients[1]!;

    const privRoom = RoomDetailSchema.parse(
      (
        await host.client.request("POST", "/api/rooms", {
          payload: {
            title: "Phòng Split",
            mode: "normal",
            visibility: "private",
            config: VALID_CONFIG,
          },
        })
      ).json(),
    );
    const joinKey = new URLSearchParams(privRoom.shareUrl!.split("?")[1]).get(
      "key",
    )!;

    const hostWs = await openWs(server, { client: host.client });
    const p2Ws = await openWs(server, { client: p2.client });
    const guestWs = await openWs(server);

    hostWs.send({ type: "subscribe", room: privRoom.code });
    p2Ws.send({ type: "subscribe", room: privRoom.code, key: joinKey });
    guestWs.send({ type: "subscribe", room: privRoom.code, key: joinKey });
    await hostWs.expectNoMessage();

    // p2 joins via REST -> subscribers receive room.updated
    await p2.client.request("POST", `/api/rooms/${privRoom.code}/join`, {
      payload: { as: "player", key: joinKey },
    });

    const hostJoinMsg = await hostWs.nextMessage();
    const p2JoinMsg = await p2Ws.nextMessage();
    const guestJoinMsg = await guestWs.nextMessage();

    if (hostJoinMsg.type === "room.updated" && !hostJoinMsg.room.restricted) {
      expect(hostJoinMsg.room.myRole).toBe("host");
      expect(hostJoinMsg.room.shareUrl).toContain(`?key=${joinKey}`);
      expect(hostJoinMsg.room.playerCount).toBe(2);
    } else {
      throw new Error("Expected unrestricted room.updated for host");
    }

    if (p2JoinMsg.type === "room.updated" && !p2JoinMsg.room.restricted) {
      expect(p2JoinMsg.room.myRole).toBe("player");
      expect(p2JoinMsg.room.shareUrl).toBeUndefined();
    } else {
      throw new Error("Expected unrestricted room.updated for player");
    }

    if (guestJoinMsg.type === "room.updated" && !guestJoinMsg.room.restricted) {
      expect(guestJoinMsg.room.myRole).toBeNull();
      expect(guestJoinMsg.room.shareUrl).toBeUndefined();
    } else {
      throw new Error("Expected unrestricted room.updated for guest with key");
    }

    // Remaining 8 join so host can split
    for (let i = 2; i < 10; i++) {
      await clients[i]!.client.request("POST", `/api/rooms/${privRoom.code}/join`, {
        payload: { as: "player", key: joinKey },
      });
      await hostWs.nextMessage((m) => m.type === "room.updated");
      await p2Ws.nextMessage((m) => m.type === "room.updated");
      await guestWs.nextMessage((m) => m.type === "room.updated");
    }

    // Host splits teams via REST
    await host.client.request("POST", `/api/rooms/${privRoom.code}/split`, {
      payload: { mode: "random" },
    });

    const hostSplit = await hostWs.nextMessage();
    const p2Split = await p2Ws.nextMessage();
    await guestWs.nextMessage((m) => m.type === "room.updated");
    if (hostSplit.type === "room.updated" && !hostSplit.room.restricted) {
      expect(hostSplit.room.lastSplit?.mode).toBe("random");
      expect(hostSplit.room.shareUrl).toContain(`?key=${joinKey}`);
    } else {
      throw new Error("Expected host split room.updated");
    }
    if (p2Split.type === "room.updated" && !p2Split.room.restricted) {
      expect(p2Split.room.lastSplit?.mode).toBe("random");
      expect(p2Split.room.shareUrl).toBeUndefined();
    } else {
      throw new Error("Expected player split room.updated");
    }

    // Unsubscribe guest, and have a member who subscribed without key leave -> restricted room.updated
    guestWs.send({ type: "unsubscribe", room: privRoom.code });
    const p3 = clients[2]!;
    const p3Ws = await openWs(server, { client: p3.client });
    p3Ws.send({ type: "subscribe", room: privRoom.code }); // subscribed as member, no key
    await p3Ws.expectNoMessage();

    await p3.client.request("POST", `/api/rooms/${privRoom.code}/leave`);
    const p3AfterLeave = await p3Ws.nextMessage();
    expect(p3AfterLeave.type).toBe("room.updated");
    if (p3AfterLeave.type === "room.updated") {
      expect(p3AfterLeave.room.restricted).toBe(true);
    }

    // Guest unsubscribed -> gets nothing
    await guestWs.expectNoMessage();
  });

  it("delivers chat.message only to active room members", async () => {
    const server = await startTestServer();
    const [host, player, spectator, outsider] = await createLoggedInClients(
      server.app,
      4,
      "ws_chat",
    );

    const room = RoomDetailSchema.parse(
      (
        await host!.client.request("POST", "/api/rooms", {
          payload: {
            title: "Phòng Chat WS",
            mode: "normal",
            visibility: "private",
            config: VALID_CONFIG,
          },
        })
      ).json(),
    );
    const joinKey = new URLSearchParams(room.shareUrl!.split("?")[1]).get("key")!;

    await player!.client.request("POST", `/api/rooms/${room.code}/join`, {
      payload: { as: "player", key: joinKey },
    });
    await spectator!.client.request("POST", `/api/rooms/${room.code}/join`, {
      payload: { as: "spectator", key: joinKey },
    });

    const hostWs = await openWs(server, { client: host!.client });
    const playerWs = await openWs(server, { client: player!.client });
    const spectatorWs = await openWs(server, { client: spectator!.client });
    const keyViewerWs = await openWs(server, { client: outsider!.client });
    const guestWs = await openWs(server);

    hostWs.send({ type: "subscribe", room: room.code });
    playerWs.send({ type: "subscribe", room: room.code });
    spectatorWs.send({ type: "subscribe", room: room.code });
    keyViewerWs.send({ type: "subscribe", room: room.code, key: joinKey });
    guestWs.send({ type: "subscribe", room: room.code, key: joinKey });
    await hostWs.expectNoMessage();

    const postRes = await player!.client.request(
      "POST",
      `/api/rooms/${room.code}/messages`,
      { payload: { text: "Chào anh em" } },
    );
    expect(postRes.statusCode).toBe(201);
    const sent = ChatMessageSchema.parse(postRes.json());

    for (const memberSocket of [hostWs, playerWs, spectatorWs]) {
      const msg = await memberSocket.nextMessage();
      expect(msg).toEqual({
        type: "chat.message",
        room: room.code,
        message: sent,
      });
    }

    // Outsider with key and guest with key must NOT receive chat messages
    await keyViewerWs.expectNoMessage();
    await guestWs.expectNoMessage();
  });

  it("sends room.kicked only to the kicked user and auto-unsubscribes them", async () => {
    const server = await startTestServer();
    const [host, kickedPlayer, otherPlayer] = await createLoggedInClients(
      server.app,
      3,
      "ws_kick",
    );

    const room = RoomDetailSchema.parse(
      (
        await host!.client.request("POST", "/api/rooms", {
          payload: {
            title: "Phòng Kick WS",
            mode: "normal",
            visibility: "public",
            config: VALID_CONFIG,
          },
        })
      ).json(),
    );

    await kickedPlayer!.client.request("POST", `/api/rooms/${room.code}/join`, {
      payload: { as: "player" },
    });
    await otherPlayer!.client.request("POST", `/api/rooms/${room.code}/join`, {
      payload: { as: "player" },
    });

    const hostWs = await openWs(server, { client: host!.client });
    const kickedWs = await openWs(server, { client: kickedPlayer!.client });
    const otherWs = await openWs(server, { client: otherPlayer!.client });

    hostWs.send({ type: "subscribe", room: room.code });
    kickedWs.send({ type: "subscribe", room: room.code });
    otherWs.send({ type: "subscribe", room: room.code });
    await hostWs.expectNoMessage();

    const kickRes = await host!.client.request(
      "POST",
      `/api/rooms/${room.code}/kick`,
      { payload: { userId: kickedPlayer!.userId } },
    );
    expect(kickRes.statusCode).toBe(200);

    // Kicked user gets room.kicked
    expect(await kickedWs.nextMessage()).toEqual({
      type: "room.kicked",
      room: room.code,
    });

    // Other subscribers get room.updated without kicked user
    const hostMsg = await hostWs.nextMessage();
    const otherMsg = await otherWs.nextMessage();
    expect(hostMsg.type).toBe("room.updated");
    expect(otherMsg.type).toBe("room.updated");

    // Subsequent room change should NOT reach kicked user (auto-unsubscribed)
    await host!.client.request("POST", `/api/rooms/${room.code}/random-lanes`);
    expect((await hostWs.nextMessage()).type).toBe("room.updated");
    await kickedWs.expectNoMessage();
  });

  it("enforces max 20 subscriptions per connection and max 5 guest connections per IP", async () => {
    const server = await startTestServer();
    const hosts = await createLoggedInClients(server.app, 21, "ws_lim");

    const codes: string[] = [];
    for (let i = 0; i < 21; i++) {
      const res = await hosts[i]!.client.request("POST", "/api/rooms", {
        payload: {
          title: `Phòng ${i + 1}`,
          mode: "normal",
          visibility: "public",
          config: VALID_CONFIG,
        },
      });
      expect(res.statusCode).toBe(201);
      codes.push(RoomDetailSchema.parse(res.json()).code);
    }

    // 5 guest connections from same IP succeed; 6th rejected
    const guestConns: WsClientWrapper[] = [];
    for (let i = 0; i < 5; i++) {
      guestConns.push(await openWs(server));
    }
    await expectWsRejected(server.wsUrl);

    // Authenticated user is NOT blocked by guest IP cap
    const hostWs = await openWs(server, { client: hosts[0]!.client });

    // Closing 1 guest connection frees a slot for another guest
    guestConns[0]!.ws.close();
    await new Promise((r) => setTimeout(r, 50));
    const replacementGuest = await openWs(server);
    expect(replacementGuest.ws.readyState).toBe(WebSocket.OPEN);

    // Test 20-subscription cap on a single connection
    for (let i = 0; i < 20; i++) {
      hostWs.send({ type: "subscribe", room: codes[i]! });
    }
    await hostWs.expectNoMessage();

    // Re-subscribing to an already subscribed room still works
    hostWs.send({ type: "subscribe", room: codes[0]! });
    await hostWs.expectNoMessage();

    // 21st distinct room -> error
    hostWs.send({ type: "subscribe", room: codes[20]! });
    expect(await hostWs.nextMessage()).toEqual({
      type: "error",
      code: "RATE_LIMITED",
      room: codes[20]!,
    });
  });

  it("pings connections periodically and terminates unresponsive sockets", async () => {
    const db = await createTestDb();
    const hub = createRoomRealtimeHub({ db, pingIntervalMs: 30 });

    class FakeSocket extends EventEmitter implements RealtimeSocket {
      readyState = 1;
      pings = 0;
      terminated = false;
      closedWith: number | undefined;
      send(): void {}
      ping(): void {
        this.pings += 1;
      }
      close(code?: number): void {
        this.readyState = 3;
        this.closedWith = code;
        this.emit("close");
      }
      terminate(): void {
        this.readyState = 3;
        this.terminated = true;
        this.emit("close");
      }
    }

    const responsive = new FakeSocket();
    responsive.on("ping", () => {}); // keep reference
    const origPing = responsive.ping.bind(responsive);
    responsive.ping = () => {
      origPing();
      responsive.emit("pong");
    };

    const unresponsive = new FakeSocket();

    hub.handleConnection(responsive, { userId: null, ip: "127.0.0.1" });
    hub.handleConnection(unresponsive, { userId: null, ip: "127.0.0.1" });

    await new Promise((r) => setTimeout(r, 110));

    expect(responsive.pings).toBeGreaterThanOrEqual(2);
    expect(responsive.terminated).toBe(false);
    expect(unresponsive.terminated).toBe(true);

    await hub.close();
    await closeDb(db);
  });
});
