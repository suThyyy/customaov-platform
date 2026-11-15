import { createHash } from "node:crypto";
import {
  normalizeVi,
  type Achievement,
  type Me,
  type RoomMatchSummary,
  type UpdateMeBody,
  type UserProfile,
  type UserSummary,
} from "@customaov/contracts";
import { and, desc, eq, sql } from "drizzle-orm";

import { toMe } from "../auth/session.js";
import type { DbClient } from "../db/client.js";
import {
  roomMatches,
  rooms,
  tournaments,
  tournamentTeamMembers,
  tournamentTeams,
  users,
} from "../db/schema.js";

export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function toUserSummary(user: typeof users.$inferSelect): UserSummary {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    level: user.level,
    crowned: user.crowned,
  };
}

function deterministicUuid(seed: string): string {
  const hash = createHash("sha256").update(seed).digest();
  hash[6] = (hash[6]! & 0x0f) | 0x50;
  hash[8] = (hash[8]! & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export async function getUserProfileByUsername(
  db: DbClient,
  username: string,
): Promise<UserProfile> {
  const normalized = username.trim().toLowerCase();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, normalized))
    .limit(1);

  if (!user) {
    throw new HttpError(404, "NOT_FOUND", "Không tìm thấy người dùng");
  }

  const matchRows = await db
    .select({
      id: roomMatches.id,
      winner: roomMatches.winner,
      blueUserIds: roomMatches.blueUserIds,
      redUserIds: roomMatches.redUserIds,
      createdAt: roomMatches.createdAt,
      roomCode: rooms.code,
      roomTitle: rooms.title,
      roomHighlight: rooms.highlight,
    })
    .from(roomMatches)
    .innerJoin(rooms, eq(roomMatches.roomId, rooms.id))
    .where(
      sql`${user.id}::uuid = ANY(${roomMatches.blueUserIds}) OR ${user.id}::uuid = ANY(${roomMatches.redUserIds})`,
    )
    .orderBy(desc(roomMatches.createdAt));

  let wins = 0;
  let losses = 0;
  const history: RoomMatchSummary[] = [];

  for (const row of matchRows) {
    const inBlue = row.blueUserIds.includes(user.id);
    const winner: "blue" | "red" = row.winner === "blue" ? "blue" : "red";
    const won = (inBlue && winner === "blue") || (!inBlue && winner === "red");
    if (won) {
      wins++;
    } else {
      losses++;
    }

    if (history.length < 20) {
      history.push({
        id: row.id,
        roomCode: row.roomCode,
        roomTitle: row.roomHighlight
          ? `${row.roomTitle} – ${row.roomHighlight}`
          : row.roomTitle,
        winner,
        result: won ? "win" : "loss",
        at: row.createdAt.toISOString(),
      });
    }
  }

  const customMatches = wins + losses;
  const winRate =
    customMatches === 0 ? 0 : Math.round((wins / customMatches) * 100);

  const joinedTeams = await db
    .select({
      tournamentId: tournaments.id,
      tournamentName: tournaments.name,
      dateStart: tournaments.dateStart,
      dateEnd: tournaments.dateEnd,
      championTeamId: tournaments.championTeamId,
      teamId: tournamentTeams.id,
      teamName: tournamentTeams.name,
    })
    .from(tournamentTeamMembers)
    .innerJoin(
      tournamentTeams,
      eq(tournamentTeamMembers.teamId, tournamentTeams.id),
    )
    .innerJoin(
      tournaments,
      eq(tournamentTeamMembers.tournamentId, tournaments.id),
    )
    .where(
      and(
        eq(tournamentTeamMembers.userId, user.id),
        eq(tournamentTeamMembers.active, true),
        eq(tournamentTeams.status, "approved"),
      ),
    );

  const tournamentsJoined = joinedTeams.length;
  const titles = joinedTeams.filter(
    (t) => t.championTeamId === t.teamId,
  ).length;

  const achievements: Achievement[] = [];

  for (const t of joinedTeams) {
    if (t.championTeamId === t.teamId) {
      achievements.push({
        id: deterministicUuid(`champion:${user.id}:${t.tournamentId}`),
        title: `Vô địch ${t.tournamentName}`,
        description: `Cùng đội ${t.teamName} vô địch giải ${t.tournamentName}.`,
        date: t.dateEnd.toISOString(),
        icon: "trophy",
      });
    }
    achievements.push({
      id: deterministicUuid(`joined:${user.id}:${t.tournamentId}`),
      title: `Tham gia ${t.tournamentName}`,
      description: `Thi đấu cùng đội ${t.teamName} tại ${t.tournamentName}.`,
      date: t.dateStart.toISOString(),
      icon: "users",
    });
  }

  if (customMatches >= 10) {
    const tenthMatch = matchRows[matchRows.length - 10]!;
    achievements.push({
      id: deterministicUuid(`matches-10:${user.id}`),
      title: "10 trận custom",
      description: "Hoàn thành 10 trận custom 5v5.",
      date: tenthMatch.createdAt.toISOString(),
      icon: "swords",
    });
  }

  if (customMatches >= 50) {
    const fiftiethMatch = matchRows[matchRows.length - 50]!;
    achievements.push({
      id: deterministicUuid(`matches-50:${user.id}`),
      title: "50 trận custom",
      description: "Hoàn thành 50 trận custom 5v5.",
      date: fiftiethMatch.createdAt.toISOString(),
      icon: "star",
    });
  }

  achievements.sort((a, b) => b.date.localeCompare(a.date));

  return {
    user: toUserSummary(user),
    uid: user.uid,
    bio: user.bio ?? "",
    bioExtra: user.bioExtra ?? "",
    roleBadge: user.roleBadge ?? "",
    playerBadge: user.playerBadge ?? "",
    stats: {
      customMatches,
      wins,
      losses,
      winRate,
      tournamentsJoined,
      titles,
    },
    achievements,
    history,
  };
}

export async function updateMyProfile(
  db: DbClient,
  userId: string,
  body: UpdateMeBody,
): Promise<Me> {
  const [current] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!current) {
    throw new HttpError(404, "NOT_FOUND", "Không tìm thấy người dùng");
  }

  const updates: Partial<typeof users.$inferInsert> = {};
  if (body.displayName !== undefined) {
    updates.displayName = body.displayName;
    updates.searchText = normalizeVi(
      `${body.displayName} ${current.username} ${current.uid}`,
    );
  }
  if (body.bio !== undefined) {
    updates.bio = body.bio;
  }
  if (body.bioExtra !== undefined) {
    updates.bioExtra = body.bioExtra;
  }
  if (body.avatarUrl !== undefined) {
    updates.avatarUrl = body.avatarUrl;
  }

  const [updated] = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, userId))
    .returning();

  if (!updated) {
    throw new HttpError(404, "NOT_FOUND", "Không tìm thấy người dùng");
  }

  return toMe(updated);
}
