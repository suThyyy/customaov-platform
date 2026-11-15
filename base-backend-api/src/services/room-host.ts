import { randomInt, randomUUID } from "node:crypto";
import {
  can,
  formatTeamsText,
  moveMember,
  type ChatMessage,
  type CreateMessageBody,
  type KickRoomMemberBody,
  type Lane,
  type Me,
  type MessagesQuery,
  type MoveRoomMemberBody,
  type RoomDetail,
  type RoomMember,
  type RoomResultBody,
  type RoomRole,
  type Side,
  type SplitRoomBody,
  type Teams,
} from "@customaov/contracts";
import {
  DEFAULT_BALANCE_LEVEL,
  DEFAULT_TIER_SCORES,
  splitTeams5v5,
} from "@customaov/team-core";
import { and, asc, desc, eq, lt, or } from "drizzle-orm";

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
import {
  RoomServiceError,
  loadRoomDetail,
  recordKickCooldown,
  toUserSummary,
  type DbOrTx,
} from "./rooms.js";

const ALL_LANES: readonly Lane[] = ["TOP", "JG", "MID", "AD", "SP"];

function shuffleLanes(): Lane[] {
  const lanes = [...ALL_LANES];
  for (let i = lanes.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    const tmp = lanes[i]!;
    lanes[i] = lanes[j]!;
    lanes[j] = tmp;
  }
  return lanes;
}

async function lockRoomForHost(
  tx: DbOrTx & { select: DbClient["select"] },
  code: string,
  currentUserId: string,
): Promise<typeof rooms.$inferSelect> {
  const [room] = await tx
    .select()
    .from(rooms)
    .where(eq(rooms.code, code))
    .for("update");

  if (!room) {
    throw new RoomServiceError(404, "NOT_FOUND", "Không tìm thấy phòng");
  }
  if (room.hostId !== currentUserId) {
    throw new RoomServiceError(
      403,
      "FORBIDDEN",
      "Chỉ chủ phòng mới có quyền thực hiện thao tác này",
    );
  }
  if (room.status === "finished") {
    throw new RoomServiceError(409, "CONFLICT", "Phòng đã kết thúc");
  }
  return room;
}

async function loadHostRow(
  tx: DbOrTx,
  hostId: string,
): Promise<typeof users.$inferSelect> {
  const [hostRow] = await tx
    .select()
    .from(users)
    .where(eq(users.id, hostId))
    .limit(1);
  if (!hostRow) {
    throw new Error("Room host missing");
  }
  return hostRow;
}

async function loadActivePlayers(
  tx: DbOrTx,
  roomId: string,
): Promise<Array<{ member: typeof roomMembers.$inferSelect; user: typeof users.$inferSelect }>> {
  return tx
    .select({ member: roomMembers, user: users })
    .from(roomMembers)
    .innerJoin(users, eq(roomMembers.userId, users.id))
    .where(
      and(
        eq(roomMembers.roomId, roomId),
        eq(roomMembers.active, true),
        eq(roomMembers.role, "player"),
      ),
    )
    .orderBy(asc(roomMembers.position), asc(roomMembers.joinedAt));
}

async function persistTeamOrder(
  tx: DbOrTx,
  roomId: string,
  side: Side,
  userIds: readonly string[],
): Promise<void> {
  for (let i = 0; i < userIds.length; i++) {
    await tx
      .update(roomMembers)
      .set({ side, position: i })
      .where(
        and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userIds[i]!)),
      );
  }
}

function toRoomMemberDto(
  row: { member: typeof roomMembers.$inferSelect; user: typeof users.$inferSelect },
): RoomMember {
  return {
    user: toUserSummary(row.user),
    lane: (row.member.lane as Lane | null) ?? null,
    ready: row.member.ready,
    captain: row.member.captain,
    tier: row.member.tier ?? null,
  };
}

export async function splitRoom(
  db: DbClient,
  code: string,
  body: SplitRoomBody,
  currentUser: Me,
  now: Date,
): Promise<RoomDetail> {
  return db.transaction(async (tx) => {
    const room = await lockRoomForHost(tx, code, currentUser.id);
    const activePlayers = await loadActivePlayers(tx, room.id);

    if (activePlayers.length !== 10) {
      throw new RoomServiceError(
        409,
        "CONFLICT",
        "Cần đủ 10 người chơi để chia đội",
      );
    }

    const splitInput = activePlayers.map((p) => ({
      id: p.user.id,
      tier: p.member.tier ?? 3,
    }));

    const balanceLevel =
      body.mode === "tier" ? (body.balanceLevel ?? DEFAULT_BALANCE_LEVEL) : null;

    const splitResult =
      body.mode === "random"
        ? splitTeams5v5(splitInput, { mode: "random" })
        : splitTeams5v5(splitInput, {
            mode: "tier",
            scores: DEFAULT_TIER_SCORES,
            balanceLevel: balanceLevel!,
            getScoreKey: (player) => player.tier,
          });

    await persistTeamOrder(
      tx,
      room.id,
      "blue",
      splitResult.teamA.map((p) => p.id),
    );
    await persistTeamOrder(
      tx,
      room.id,
      "red",
      splitResult.teamB.map((p) => p.id),
    );

    const lastSplit = {
      mode: body.mode,
      balanceLevel,
      warning: splitResult.warning
        ? "Chênh lệch trình độ giữa hai đội khá cao."
        : null,
      at: now.toISOString(),
    };

    const [updatedRoom] = await tx
      .update(rooms)
      .set({ lastSplit })
      .where(eq(rooms.id, room.id))
      .returning();

    await tx.insert(roomMessages).values({
      roomId: room.id,
      authorId: null,
      text:
        body.mode === "random"
          ? "Đã chia đội ngẫu nhiên 5v5."
          : "Đã chia đội cân bằng theo bậc.",
      system: true,
      createdAt: now,
    });

    const hostRow = await loadHostRow(tx, room.hostId);
    return loadRoomDetail(tx, updatedRoom ?? room, hostRow, currentUser.id);
  });
}

export async function moveRoomMember(
  db: DbClient,
  code: string,
  body: MoveRoomMemberBody,
  currentUser: Me,
): Promise<RoomDetail> {
  return db.transaction(async (tx) => {
    const room = await lockRoomForHost(tx, code, currentUser.id);
    const activePlayers = await loadActivePlayers(tx, room.id);

    const teams: Teams = { blue: [], red: [] };
    for (const row of activePlayers) {
      const dto = toRoomMemberDto(row);
      if (row.member.side === "red") {
        teams.red.push(dto);
      } else {
        teams.blue.push(dto);
      }
    }

    const perSide = Math.floor(room.capacity / 2);
    const result = moveMember(teams, body.userId, body.to, perSide, body.targetUserId);
    if (!result.ok) {
      throw new RoomServiceError(409, "CONFLICT", result.message);
    }

    await persistTeamOrder(
      tx,
      room.id,
      "blue",
      result.teams.blue.map((m) => m.user.id),
    );
    await persistTeamOrder(
      tx,
      room.id,
      "red",
      result.teams.red.map((m) => m.user.id),
    );

    const hostRow = await loadHostRow(tx, room.hostId);
    return loadRoomDetail(tx, room, hostRow, currentUser.id);
  });
}

export async function kickRoomMember(
  db: DbClient,
  code: string,
  body: KickRoomMemberBody,
  currentUser: Me,
  now: Date,
): Promise<RoomDetail> {
  return db.transaction(async (tx) => {
    const room = await lockRoomForHost(tx, code, currentUser.id);

    if (body.userId === currentUser.id) {
      throw new RoomServiceError(
        400,
        "VALIDATION",
        "Không thể tự mời mình ra khỏi phòng, hãy dùng chức năng rời phòng",
      );
    }

    const [target] = await tx
      .select({ member: roomMembers, user: users })
      .from(roomMembers)
      .innerJoin(users, eq(roomMembers.userId, users.id))
      .where(
        and(
          eq(roomMembers.roomId, room.id),
          eq(roomMembers.userId, body.userId),
          eq(roomMembers.active, true),
        ),
      )
      .limit(1);

    if (!target) {
      throw new RoomServiceError(
        404,
        "NOT_FOUND",
        "Người chơi không có trong phòng",
      );
    }

    await tx
      .update(roomMembers)
      .set({ active: false, captain: false })
      .where(
        and(eq(roomMembers.roomId, room.id), eq(roomMembers.userId, body.userId)),
      );

    recordKickCooldown(room.id, body.userId, now);

    await tx.insert(roomMessages).values({
      roomId: room.id,
      authorId: null,
      text: `${target.user.displayName} đã bị mời ra khỏi phòng.`,
      system: true,
      createdAt: now,
    });

    const hostRow = await loadHostRow(tx, room.hostId);
    return loadRoomDetail(tx, room, hostRow, currentUser.id);
  });
}

export async function randomRoomLanes(
  db: DbClient,
  code: string,
  currentUser: Me,
): Promise<RoomDetail> {
  return db.transaction(async (tx) => {
    const room = await lockRoomForHost(tx, code, currentUser.id);
    const activePlayers = await loadActivePlayers(tx, room.id);

    const bluePlayers = activePlayers.filter((p) => p.member.side !== "red");
    const redPlayers = activePlayers.filter((p) => p.member.side === "red");

    for (const group of [bluePlayers, redPlayers]) {
      const lanes = shuffleLanes();
      for (let i = 0; i < group.length; i++) {
        const player = group[i]!;
        const lane = lanes[i] ?? null;
        await tx
          .update(roomMembers)
          .set({ lane })
          .where(
            and(
              eq(roomMembers.roomId, room.id),
              eq(roomMembers.userId, player.user.id),
            ),
          );
      }
    }

    const hostRow = await loadHostRow(tx, room.hostId);
    return loadRoomDetail(tx, room, hostRow, currentUser.id);
  });
}

export async function submitRoomResult(
  db: DbClient,
  code: string,
  body: RoomResultBody,
  currentUser: Me,
  now: Date,
): Promise<RoomDetail> {
  return db.transaction(async (tx) => {
    const room = await lockRoomForHost(tx, code, currentUser.id);

    const [existingMatch] = await tx
      .select({ id: roomMatches.id })
      .from(roomMatches)
      .where(eq(roomMatches.roomId, room.id))
      .limit(1);
    if (existingMatch) {
      throw new RoomServiceError(409, "CONFLICT", "Phòng đã có kết quả");
    }

    const activePlayers = await loadActivePlayers(tx, room.id);
    const blueUserIds = activePlayers
      .filter((p) => p.member.side !== "red")
      .map((p) => p.user.id);
    const redUserIds = activePlayers
      .filter((p) => p.member.side === "red")
      .map((p) => p.user.id);

    if (blueUserIds.length !== 5 || redUserIds.length !== 5) {
      throw new RoomServiceError(
        409,
        "CONFLICT",
        "Cần đủ 10 người chơi (5-5) để ghi nhận kết quả",
      );
    }

    await tx.insert(roomMatches).values({
      roomId: room.id,
      winner: body.winner,
      blueUserIds,
      redUserIds,
      createdAt: now,
    });

    const [finishedRoom] = await tx
      .update(rooms)
      .set({ status: "finished", finishedAt: now })
      .where(eq(rooms.id, room.id))
      .returning();

    await tx
      .update(roomMembers)
      .set({ active: false, captain: false })
      .where(eq(roomMembers.roomId, room.id));

    const winnerLabel = body.winner === "blue" ? "Team Xanh" : "Team Đỏ";
    await tx.insert(roomMessages).values({
      roomId: room.id,
      authorId: null,
      text: `Trận đấu kết thúc: ${winnerLabel} thắng.`,
      system: true,
      createdAt: now,
    });

    const activityId = randomUUID();
    await tx.insert(activities).values({
      id: activityId,
      kind: "result",
      actorId: currentUser.id,
      roomId: room.id,
      tournamentId: null,
      text: `Trận đấu phòng "${room.title}" đã kết thúc`,
      emphasis: `${winnerLabel} thắng`,
      createdAt: now,
    });

    const allPlayerIds = [...blueUserIds, ...redUserIds];
    await tx.insert(activityRecipients).values(
      allPlayerIds.map((userId) => ({ activityId, userId })),
    );

    const hostRow = await loadHostRow(tx, room.hostId);
    return loadRoomDetail(tx, finishedRoom ?? room, hostRow, currentUser.id);
  });
}

export async function exportRoomTeams(
  db: DbClient,
  code: string,
  currentUserId: string,
): Promise<string> {
  const [row] = await db
    .select({ room: rooms, host: users })
    .from(rooms)
    .innerJoin(users, eq(rooms.hostId, users.id))
    .where(eq(rooms.code, code))
    .limit(1);

  if (!row) {
    throw new RoomServiceError(404, "NOT_FOUND", "Không tìm thấy phòng");
  }

  const [membership] = await db
    .select({ userId: roomMembers.userId })
    .from(roomMembers)
    .where(
      and(
        eq(roomMembers.roomId, row.room.id),
        eq(roomMembers.userId, currentUserId),
        eq(roomMembers.active, true),
      ),
    )
    .limit(1);

  if (!membership) {
    throw new RoomServiceError(
      403,
      "FORBIDDEN",
      "Chỉ thành viên trong phòng mới có thể xuất đội hình",
    );
  }

  const detail = await loadRoomDetail(db, row.room, row.host, currentUserId);
  return formatTeamsText(
    {
      code: detail.code,
      title: detail.title,
      highlight: detail.highlight,
    },
    detail.teams,
  );
}

export async function getRoomMessages(
  db: DbClient,
  code: string,
  query: MessagesQuery,
  currentUserId: string,
): Promise<ChatMessage[]> {
  const [room] = await db
    .select()
    .from(rooms)
    .where(eq(rooms.code, code))
    .limit(1);

  if (!room) {
    throw new RoomServiceError(404, "NOT_FOUND", "Không tìm thấy phòng");
  }

  const [membership] = await db
    .select({ userId: roomMembers.userId })
    .from(roomMembers)
    .where(
      and(
        eq(roomMembers.roomId, room.id),
        eq(roomMembers.userId, currentUserId),
        eq(roomMembers.active, true),
      ),
    )
    .limit(1);

  if (!membership) {
    throw new RoomServiceError(
      403,
      "FORBIDDEN",
      "Chỉ thành viên trong phòng mới có thể xem tin nhắn",
    );
  }

  const conditions = [eq(roomMessages.roomId, room.id)];

  if (query.before) {
    const [cursor] = await db
      .select({ id: roomMessages.id, createdAt: roomMessages.createdAt })
      .from(roomMessages)
      .where(
        and(eq(roomMessages.roomId, room.id), eq(roomMessages.id, query.before)),
      )
      .limit(1);

    if (!cursor) {
      return [];
    }

    conditions.push(
      or(
        lt(roomMessages.createdAt, cursor.createdAt),
        and(
          eq(roomMessages.createdAt, cursor.createdAt),
          lt(roomMessages.id, cursor.id),
        ),
      )!,
    );
  }

  const rows = await db
    .select({ msg: roomMessages, author: users })
    .from(roomMessages)
    .leftJoin(users, eq(roomMessages.authorId, users.id))
    .where(and(...conditions))
    .orderBy(desc(roomMessages.createdAt), desc(roomMessages.id))
    .limit(50);

  return rows.reverse().map((row) => ({
    id: row.msg.id,
    author: row.author ? toUserSummary(row.author) : null,
    text: row.msg.text,
    system: row.msg.system,
    at: row.msg.createdAt.toISOString(),
  }));
}

export async function postRoomMessage(
  db: DbClient,
  code: string,
  body: CreateMessageBody,
  currentUser: Me,
  now: Date,
): Promise<ChatMessage> {
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

    const role: RoomRole =
      room.hostId === currentUser.id ? "host" : (member.role as RoomRole);
    if (!can(role, "chat")) {
      throw new RoomServiceError(
        403,
        "FORBIDDEN",
        "Khán giả không thể gửi tin nhắn",
      );
    }

    const [inserted] = await tx
      .insert(roomMessages)
      .values({
        roomId: room.id,
        authorId: currentUser.id,
        text: body.text,
        system: false,
        createdAt: now,
      })
      .returning();

    if (!inserted) {
      throw new Error("Insert message returned no row");
    }

    const [authorRow] = await tx
      .select()
      .from(users)
      .where(eq(users.id, currentUser.id))
      .limit(1);

    if (!authorRow) {
      throw new RoomServiceError(401, "UNAUTHENTICATED", "Phiên đăng nhập không hợp lệ");
    }

    return {
      id: inserted.id,
      author: toUserSummary(authorRow),
      text: inserted.text,
      system: inserted.system,
      at: inserted.createdAt.toISOString(),
    };
  });
}
