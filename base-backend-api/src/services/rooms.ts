import { randomBytes, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import {
  normalizeVi,
  type CreateRoomBody,
  type ErrorCode,
  type JoinRoomBody,
  type Lane,
  type Me,
  type RoomDetail,
  type RoomDetailResponse,
  type RoomMember,
  type RoomMode,
  type RoomStatus,
  type RoomSummary,
  type RoomVisibility,
  type RoomsQuery,
  type RoomsResponse,
  type Side,
  type UpdateRoomMeBody,
  type UserSummary,
} from "@customaov/contracts";
import { and, asc, desc, eq, exists, inArray, ne, or, sql } from "drizzle-orm";

import type { DbClient } from "../db/client.js";
import {
  activities,
  activityRecipients,
  roomMatches,
  roomMembers,
  roomMessages,
  rooms,
  users,
} from "../db/schema.js";

export type DbOrTx = Pick<DbClient, "select" | "insert" | "update" | "delete">;

const KICK_COOLDOWN_MS = 10 * 60 * 1000;
const kickCooldowns = new Map<string, number>();

export function recordKickCooldown(roomId: string, userId: string, now: Date): void {
  kickCooldowns.set(`${roomId}:${userId}`, now.getTime() + KICK_COOLDOWN_MS);
}

export function isKickCooldownActive(roomId: string, userId: string, now: Date): boolean {
  const key = `${roomId}:${userId}`;
  const until = kickCooldowns.get(key);
  if (until === undefined) return false;
  if (now.getTime() >= until) {
    kickCooldowns.delete(key);
    return false;
  }
  return true;
}

const MODE_LABELS: Record<RoomMode, string> = {
  normal: "Custom",
  tournament: "Căng",
  friendly: "Vui",
  other: "Khác",
};

const ROOM_THUMBNAILS = [
  "/mock-assets/room-1.jpg",
  "/mock-assets/room-2.jpg",
  "/mock-assets/room-3.jpg",
  "/mock-assets/room-4.jpg",
  "/mock-assets/room-5.jpg",
];

export class RoomServiceError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export function toUserSummary(user: typeof users.$inferSelect): UserSummary {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    level: user.level,
    crowned: user.crowned,
  };
}

function formatModeLabel(format: string, mode: RoomMode): string {
  return `${format} · ${MODE_LABELS[mode]}`;
}

function keysMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

function extractPgConstraint(err: unknown): {
  code?: string;
  constraint?: string | undefined;
} {
  let current: unknown = err;
  for (let i = 0; i < 4 && typeof current === "object" && current !== null; i++) {
    const rec = current as Record<string, unknown>;
    if (typeof rec.code === "string") {
      return {
        code: rec.code,
        constraint: typeof rec.constraint === "string" ? rec.constraint : undefined,
      };
    }
    current = rec.cause;
  }
  return {};
}

function isUniqueViolation(err: unknown, constraint?: string): boolean {
  const info = extractPgConstraint(err);
  if (info.code !== "23505") return false;
  if (!constraint) return true;
  return info.constraint === constraint;
}

async function throwActiveRoomConflict(db: DbClient, userId: string): Promise<never> {
  const [existing] = await db
    .select({ code: rooms.code })
    .from(roomMembers)
    .innerJoin(rooms, eq(roomMembers.roomId, rooms.id))
    .where(
      and(
        eq(roomMembers.userId, userId),
        eq(roomMembers.role, "player"),
        eq(roomMembers.active, true),
      ),
    )
    .limit(1);
  const roomHint = existing ? ` (${existing.code})` : "";
  throw new RoomServiceError(
    409,
    "CONFLICT",
    `Bạn đang là người chơi ở phòng khác${roomHint}`,
  );
}

function toRoomSummary(
  room: typeof rooms.$inferSelect,
  host: typeof users.$inferSelect,
  playerCount: number,
  isMember: boolean,
): RoomSummary {
  const mode = room.mode as RoomMode;
  return {
    code: room.code,
    title: room.title,
    highlight: room.highlight,
    thumbnail: room.thumbnail,
    host: toUserSummary(host),
    mode,
    modeLabel: formatModeLabel(room.config.format, mode),
    visibility: room.visibility as RoomVisibility,
    playerCount,
    capacity: room.capacity,
    status: room.status as RoomStatus,
    isMember,
  };
}

export async function loadRoomDetail(
  db: DbOrTx,
  room: typeof rooms.$inferSelect,
  host: typeof users.$inferSelect,
  currentUserId: string | null,
): Promise<RoomDetail> {
  const memberRows = await db
    .select({ member: roomMembers, user: users })
    .from(roomMembers)
    .innerJoin(users, eq(roomMembers.userId, users.id))
    .where(and(eq(roomMembers.roomId, room.id), eq(roomMembers.active, true)))
    .orderBy(asc(roomMembers.position), asc(roomMembers.joinedAt));

  const blue: RoomMember[] = [];
  const red: RoomMember[] = [];
  const spectators: UserSummary[] = [];
  let myMember: (typeof memberRows)[number]["member"] | undefined;

  for (const row of memberRows) {
    if (currentUserId && row.member.userId === currentUserId) {
      myMember = row.member;
    }
    const userSummary = toUserSummary(row.user);
    if (row.member.role === "player") {
      const memberDto: RoomMember = {
        user: userSummary,
        lane: (row.member.lane as Lane | null) ?? null,
        ready: row.member.ready,
        captain: row.member.captain,
        tier: row.member.tier ?? null,
      };
      if (row.member.side === "red") {
        red.push(memberDto);
      } else {
        blue.push(memberDto);
      }
    } else {
      spectators.push(userSummary);
    }
  }

  const [latestMatch] = await db
    .select()
    .from(roomMatches)
    .where(eq(roomMatches.roomId, room.id))
    .orderBy(desc(roomMatches.createdAt))
    .limit(1);

  const playerCount = blue.length + red.length;
  const isMember = Boolean(myMember);
  const isHost = Boolean(currentUserId && room.hostId === currentUserId);
  const myRole: RoomDetail["myRole"] = !currentUserId
    ? null
    : isHost
      ? "host"
      : myMember
        ? (myMember.role as "player" | "spectator")
        : null;

  const summary = toRoomSummary(room, host, playerCount, isMember);
  const shareUrl = isHost
    ? room.joinKey
      ? `/rooms/${room.code}?key=${room.joinKey}`
      : `/rooms/${room.code}`
    : undefined;

  return {
    ...summary,
    config: room.config,
    teams: { blue, red },
    spectators,
    myRole,
    lastSplit: room.lastSplit
      ? {
          mode: room.lastSplit.mode,
          balanceLevel: room.lastSplit.balanceLevel,
          warning: Boolean(room.lastSplit.warning),
          at: room.lastSplit.at,
        }
      : null,
    result: latestMatch
      ? {
          winner: latestMatch.winner as Side,
          at: latestMatch.createdAt.toISOString(),
        }
      : null,
    ...(shareUrl ? { shareUrl } : {}),
  };
}

export async function listRooms(
  db: DbClient,
  query: RoomsQuery,
  currentUserId: string | null,
): Promise<RoomsResponse> {
  if (query.mine === "1" && !currentUserId) {
    throw new RoomServiceError(401, "UNAUTHENTICATED", "Vui lòng đăng nhập");
  }

  const conditions = [];

  if (query.mine === "1" && currentUserId) {
    conditions.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(roomMembers)
          .where(
            and(
              eq(roomMembers.roomId, rooms.id),
              eq(roomMembers.userId, currentUserId),
              eq(roomMembers.active, true),
            ),
          ),
      ),
    );
  } else if (currentUserId) {
    conditions.push(
      or(
        eq(rooms.visibility, "public"),
        exists(
          db
            .select({ one: sql`1` })
            .from(roomMembers)
            .where(
              and(
                eq(roomMembers.roomId, rooms.id),
                eq(roomMembers.userId, currentUserId),
                eq(roomMembers.active, true),
              ),
            ),
        ),
      ),
    );
  } else {
    conditions.push(eq(rooms.visibility, "public"));
  }

  if (query.mode) {
    conditions.push(eq(rooms.mode, query.mode));
  }
  if (query.status) {
    conditions.push(eq(rooms.status, query.status));
  } else if (query.mine !== "1") {
    conditions.push(ne(rooms.status, "finished"));
  }
  if (query.q) {
    const normalized = normalizeVi(query.q.trim());
    if (normalized.length > 0) {
      const escaped = normalized.replace(/[\\%_]/g, "\\$&");
      conditions.push(sql`${rooms.searchText} LIKE ${`%${escaped}%`} ESCAPE '\\'`);
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [countRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(rooms)
    .where(whereClause);
  const total = countRow?.total ?? 0;

  const rows = await db
    .select({ room: rooms, host: users })
    .from(rooms)
    .innerJoin(users, eq(rooms.hostId, users.id))
    .where(whereClause)
    .orderBy(desc(rooms.createdAt), asc(rooms.code))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);

  const roomIds = rows.map((r) => r.room.id);
  const playerCountByRoom = new Map<string, number>();
  const myRooms = new Set<string>();

  if (roomIds.length > 0) {
    const counts = await db
      .select({
        roomId: roomMembers.roomId,
        count: sql<number>`count(*)::int`,
      })
      .from(roomMembers)
      .where(
        and(
          inArray(roomMembers.roomId, roomIds),
          eq(roomMembers.role, "player"),
          eq(roomMembers.active, true),
        ),
      )
      .groupBy(roomMembers.roomId);

    for (const c of counts) {
      playerCountByRoom.set(c.roomId, c.count);
    }

    if (currentUserId) {
      const memberships = await db
        .select({ roomId: roomMembers.roomId })
        .from(roomMembers)
        .where(
          and(
            inArray(roomMembers.roomId, roomIds),
            eq(roomMembers.userId, currentUserId),
            eq(roomMembers.active, true),
          ),
        );
      for (const m of memberships) {
        myRooms.add(m.roomId);
      }
    }
  }

  const items = rows.map((r) =>
    toRoomSummary(
      r.room,
      r.host,
      playerCountByRoom.get(r.room.id) ?? 0,
      myRooms.has(r.room.id),
    ),
  );

  return {
    items,
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function createRoom(
  db: DbClient,
  input: CreateRoomBody,
  currentUser: Me,
  now: Date,
): Promise<RoomDetail> {
  const joinKey =
    input.visibility === "private" ? randomBytes(16).toString("base64url") : null;
  const thumbnail = ROOM_THUMBNAILS[randomInt(0, ROOM_THUMBNAILS.length)]!;
  const highlight = input.highlight ?? null;
  const fullTitle = highlight ? `${input.title} – ${highlight}` : input.title;

  for (let attempt = 0; attempt < 8; attempt++) {
    const code = `AOV-${randomInt(1000, 1_000_000)}`;
    const searchText = normalizeVi(`${code} ${fullTitle}`);

    try {
      return await db.transaction(async (tx) => {
        const [room] = await tx
          .insert(rooms)
          .values({
            code,
            title: input.title,
            highlight,
            thumbnail,
            hostId: currentUser.id,
            mode: input.mode,
            visibility: input.visibility,
            capacity: 10,
            status: "waiting",
            config: input.config,
            joinKey,
            lastSplit: null,
            searchText,
            createdAt: now,
          })
          .returning();

        if (!room) {
          throw new Error("Insert room returned no row");
        }

        await tx.insert(roomMembers).values({
          roomId: room.id,
          userId: currentUser.id,
          role: "player",
          side: "blue",
          lane: null,
          ready: false,
          captain: true,
          tier: null,
          active: true,
          joinedAt: now,
          position: 0,
        });

        await tx.insert(roomMessages).values({
          roomId: room.id,
          authorId: null,
          text: `${currentUser.displayName} đã tạo phòng.`,
          system: true,
          createdAt: now,
        });

        const [hostRow] = await tx
          .select()
          .from(users)
          .where(eq(users.id, currentUser.id))
          .limit(1);
        if (!hostRow) {
          throw new RoomServiceError(401, "UNAUTHENTICATED", "Phiên đăng nhập không hợp lệ");
        }

        return loadRoomDetail(tx, room, hostRow, currentUser.id);
      });
    } catch (err) {
      if (isUniqueViolation(err, "room_members_active_player_uidx")) {
        await throwActiveRoomConflict(db, currentUser.id);
      }
      if (isUniqueViolation(err, "rooms_code_unique") && attempt < 7) {
        continue;
      }
      throw err;
    }
  }

  throw new Error("Could not allocate unique room code");
}

export async function getRoomDetail(
  db: DbClient,
  code: string,
  currentUserId: string | null,
  key?: string,
): Promise<RoomDetailResponse> {
  const [row] = await db
    .select({ room: rooms, host: users })
    .from(rooms)
    .innerJoin(users, eq(rooms.hostId, users.id))
    .where(eq(rooms.code, code))
    .limit(1);

  if (!row) {
    throw new RoomServiceError(404, "NOT_FOUND", "Không tìm thấy phòng");
  }

  const { room, host } = row;
  if (room.visibility === "private") {
    const isMember = currentUserId
      ? Boolean(
          (
            await db
              .select({ userId: roomMembers.userId })
              .from(roomMembers)
              .where(
                and(
                  eq(roomMembers.roomId, room.id),
                  eq(roomMembers.userId, currentUserId),
                  eq(roomMembers.active, true),
                ),
              )
              .limit(1)
          )[0],
        )
      : false;

    if (!isMember && !keysMatch(key, room.joinKey)) {
      const [countRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(roomMembers)
        .where(
          and(
            eq(roomMembers.roomId, room.id),
            eq(roomMembers.role, "player"),
            eq(roomMembers.active, true),
          ),
        );
      return {
        ...toRoomSummary(room, host, countRow?.count ?? 0, false),
        restricted: true,
      };
    }
  }

  const detail = await loadRoomDetail(db, room, host, currentUserId);
  return { ...detail, restricted: false };
}

/**
 * Ghi activity `join` (E6-T01) khi một người vào phòng với vai người chơi. Recipients: người vào + chủ phòng.
 * Chỉ ghi một lần cho mỗi cặp (người vào, phòng): vào lại sau khi rời không tạo thêm mục trùng.
 */
async function recordJoinActivity(
  tx: DbOrTx,
  room: typeof rooms.$inferSelect,
  currentUser: Me,
  now: Date,
): Promise<void> {
  const [existing] = await tx
    .select({ id: activities.id })
    .from(activities)
    .where(
      and(
        eq(activities.kind, "join"),
        eq(activities.actorId, currentUser.id),
        eq(activities.roomId, room.id),
      ),
    )
    .limit(1);
  if (existing) return;

  const activityId = randomUUID();
  await tx.insert(activities).values({
    id: activityId,
    kind: "join",
    actorId: currentUser.id,
    roomId: room.id,
    tournamentId: null,
    text: `${currentUser.displayName} đã vào phòng "${room.title}"`,
    emphasis: null,
    createdAt: now,
  });
  const recipientIds = [...new Set([currentUser.id, room.hostId])];
  await tx
    .insert(activityRecipients)
    .values(recipientIds.map((userId) => ({ activityId, userId })));
}

export async function joinRoom(
  db: DbClient,
  code: string,
  body: JoinRoomBody,
  currentUser: Me,
  now: Date,
): Promise<RoomDetail> {
  try {
    return await db.transaction(async (tx) => {
      const [room] = await tx
        .select()
        .from(rooms)
        .where(eq(rooms.code, code))
        .for("update");

      if (!room) {
        throw new RoomServiceError(404, "NOT_FOUND", "Không tìm thấy phòng");
      }
      if (room.status === "finished") {
        throw new RoomServiceError(409, "CONFLICT", "Phòng đã kết thúc");
      }

      const activeMembers = await tx
        .select()
        .from(roomMembers)
        .where(and(eq(roomMembers.roomId, room.id), eq(roomMembers.active, true)));

      if (activeMembers.some((m) => m.userId === currentUser.id)) {
        throw new RoomServiceError(409, "CONFLICT", "Bạn đã ở trong phòng này");
      }

      if (isKickCooldownActive(room.id, currentUser.id, now)) {
        throw new RoomServiceError(
          409,
          "CONFLICT",
          "Bạn vừa bị mời ra khỏi phòng, vui lòng thử lại sau 10 phút",
        );
      }

      if (room.visibility === "private" && !keysMatch(body.key, room.joinKey)) {
        throw new RoomServiceError(
          403,
          "FORBIDDEN",
          "Phòng riêng tư cần mã mời hợp lệ",
        );
      }

      const nextPosition =
        activeMembers.reduce((max, m) => Math.max(max, m.position), -1) + 1;

      if (body.as === "player") {
        if (room.status !== "waiting") {
          throw new RoomServiceError(
            409,
            "CONFLICT",
            "Phòng đang thi đấu, chỉ có thể vào xem",
          );
        }
        const activePlayers = activeMembers.filter((m) => m.role === "player");
        if (activePlayers.length >= room.capacity) {
          throw new RoomServiceError(409, "CONFLICT", "Phòng đã đủ 10 người chơi");
        }
        const blueCount = activePlayers.filter((m) => m.side === "blue").length;
        const redCount = activePlayers.filter((m) => m.side === "red").length;
        const side: Side = blueCount <= redCount ? "blue" : "red";

        await tx
          .insert(roomMembers)
          .values({
            roomId: room.id,
            userId: currentUser.id,
            role: "player",
            side,
            lane: null,
            ready: false,
            captain: false,
            tier: null,
            active: true,
            joinedAt: now,
            position: nextPosition,
          })
          .onConflictDoUpdate({
            target: [roomMembers.roomId, roomMembers.userId],
            set: {
              role: "player",
              side,
              lane: null,
              ready: false,
              captain: false,
              tier: null,
              active: true,
              joinedAt: now,
              position: nextPosition,
            },
          });
      } else {
        await tx
          .insert(roomMembers)
          .values({
            roomId: room.id,
            userId: currentUser.id,
            role: "spectator",
            side: null,
            lane: null,
            ready: false,
            captain: false,
            tier: null,
            active: true,
            joinedAt: now,
            position: nextPosition,
          })
          .onConflictDoUpdate({
            target: [roomMembers.roomId, roomMembers.userId],
            set: {
              role: "spectator",
              side: null,
              lane: null,
              ready: false,
              captain: false,
              tier: null,
              active: true,
              joinedAt: now,
              position: nextPosition,
            },
          });
      }

      if (body.as === "player") {
        await recordJoinActivity(tx, room, currentUser, now);
      }

      await tx.insert(roomMessages).values({
        roomId: room.id,
        authorId: null,
        text:
          body.as === "player"
            ? `${currentUser.displayName} đã vào phòng.`
            : `${currentUser.displayName} đã vào xem.`,
        system: true,
        createdAt: now,
      });

      const [hostRow] = await tx
        .select()
        .from(users)
        .where(eq(users.id, room.hostId))
        .limit(1);
      if (!hostRow) {
        throw new Error("Room host missing");
      }

      return loadRoomDetail(tx, room, hostRow, currentUser.id);
    });
  } catch (err) {
    if (isUniqueViolation(err, "room_members_active_player_uidx")) {
      await throwActiveRoomConflict(db, currentUser.id);
    }
    throw err;
  }
}

export async function leaveRoom(
  db: DbClient,
  code: string,
  currentUser: Me,
  now: Date,
): Promise<RoomDetail> {
  return db.transaction(async (tx) => {
    const [room] = await tx
      .select()
      .from(rooms)
      .where(eq(rooms.code, code))
      .for("update");

    if (!room) {
      throw new RoomServiceError(404, "NOT_FOUND", "Không tìm thấy phòng");
    }
    if (room.status === "finished") {
      throw new RoomServiceError(409, "CONFLICT", "Phòng đã kết thúc");
    }

    const [member] = await tx
      .select()
      .from(roomMembers)
      .where(
        and(
          eq(roomMembers.roomId, room.id),
          eq(roomMembers.userId, currentUser.id),
          eq(roomMembers.active, true),
        ),
      )
      .limit(1);

    if (!member) {
      throw new RoomServiceError(
        403,
        "FORBIDDEN",
        "Bạn không phải thành viên phòng này",
      );
    }

    await tx
      .update(roomMembers)
      .set({ active: false, captain: false })
      .where(
        and(eq(roomMembers.roomId, room.id), eq(roomMembers.userId, currentUser.id)),
      );

    const remaining = await tx
      .select({ member: roomMembers, user: users })
      .from(roomMembers)
      .innerJoin(users, eq(roomMembers.userId, users.id))
      .where(and(eq(roomMembers.roomId, room.id), eq(roomMembers.active, true)))
      .orderBy(asc(roomMembers.joinedAt), asc(roomMembers.position));

    let updatedRoom = room;

    if (remaining.length === 0) {
      const [finished] = await tx
        .update(rooms)
        .set({ status: "finished", finishedAt: now })
        .where(eq(rooms.id, room.id))
        .returning();
      if (finished) updatedRoom = finished;

      await tx.insert(roomMessages).values({
        roomId: room.id,
        authorId: null,
        text: `${currentUser.displayName} đã rời phòng. Phòng đã kết thúc.`,
        system: true,
        createdAt: now,
      });
    } else if (room.hostId === currentUser.id) {
      const nextHost = remaining[0]!;
      const [transferred] = await tx
        .update(rooms)
        .set({ hostId: nextHost.user.id })
        .where(eq(rooms.id, room.id))
        .returning();
      if (transferred) updatedRoom = transferred;

      if (nextHost.member.role === "player") {
        await tx
          .update(roomMembers)
          .set({ captain: true })
          .where(
            and(
              eq(roomMembers.roomId, room.id),
              eq(roomMembers.userId, nextHost.user.id),
            ),
          );
      }

      await tx.insert(roomMessages).values({
        roomId: room.id,
        authorId: null,
        text: `${currentUser.displayName} đã rời phòng. ${nextHost.user.displayName} trở thành chủ phòng.`,
        system: true,
        createdAt: now,
      });
    } else {
      await tx.insert(roomMessages).values({
        roomId: room.id,
        authorId: null,
        text: `${currentUser.displayName} đã rời phòng.`,
        system: true,
        createdAt: now,
      });
    }

    const [hostRow] = await tx
      .select()
      .from(users)
      .where(eq(users.id, updatedRoom.hostId))
      .limit(1);
    if (!hostRow) {
      throw new Error("Room host missing");
    }

    return loadRoomDetail(tx, updatedRoom, hostRow, currentUser.id);
  });
}

export async function updateRoomMe(
  db: DbClient,
  code: string,
  body: UpdateRoomMeBody,
  currentUser: Me,
): Promise<RoomDetail> {
  return db.transaction(async (tx) => {
    const [room] = await tx
      .select()
      .from(rooms)
      .where(eq(rooms.code, code))
      .for("update");

    if (!room) {
      throw new RoomServiceError(404, "NOT_FOUND", "Không tìm thấy phòng");
    }
    if (room.status === "finished") {
      throw new RoomServiceError(409, "CONFLICT", "Phòng đã kết thúc");
    }

    const [member] = await tx
      .select()
      .from(roomMembers)
      .where(
        and(
          eq(roomMembers.roomId, room.id),
          eq(roomMembers.userId, currentUser.id),
          eq(roomMembers.active, true),
        ),
      )
      .limit(1);

    if (!member) {
      throw new RoomServiceError(
        403,
        "FORBIDDEN",
        "Bạn không phải thành viên phòng này",
      );
    }
    if (member.role !== "player") {
      throw new RoomServiceError(
        403,
        "FORBIDDEN",
        "Khán giả không thể cập nhật thông tin người chơi",
      );
    }

    const patch: Partial<typeof roomMembers.$inferInsert> = {};
    if (body.lane !== undefined) patch.lane = body.lane;
    if (body.ready !== undefined) patch.ready = body.ready;
    if (body.tier !== undefined) patch.tier = body.tier;

    await tx
      .update(roomMembers)
      .set(patch)
      .where(
        and(eq(roomMembers.roomId, room.id), eq(roomMembers.userId, currentUser.id)),
      );

    const [hostRow] = await tx
      .select()
      .from(users)
      .where(eq(users.id, room.hostId))
      .limit(1);
    if (!hostRow) {
      throw new Error("Room host missing");
    }

    return loadRoomDetail(tx, room, hostRow, currentUser.id);
  });
}
