import { randomInt, randomUUID } from "node:crypto";
import type {
  ErrorCode,
  ScheduleMatchBody,
  ScoreMatchBody,
  Series,
} from "@customaov/contracts";
import { and, asc, eq, inArray } from "drizzle-orm";

import type { DbClient } from "../db/client.js";
import {
  activities,
  activityRecipients,
  bracketMatches,
  tournamentTeamMembers,
  tournamentTeams,
  tournaments,
} from "../db/schema.js";
import {
  BracketError,
  championOf,
  matchLabel,
  planBracket,
  recordScore,
  type BracketErrorCode,
  type MatchNode,
} from "./bracket/index.js";

export class TournamentBracketError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

type Tx = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
type TournamentRow = typeof tournaments.$inferSelect;
type MatchRow = typeof bracketMatches.$inferSelect;

/** `crypto.randomInt` dưới dạng hàm random [0, 1) cho `planBracket`. */
const RANDOM_RANGE = 2 ** 48 - 1;
function cryptoRandom(): number {
  return randomInt(0, RANDOM_RANGE) / RANDOM_RANGE;
}

const ENGINE_ERROR_STATUS: Record<BracketErrorCode, [number, ErrorCode]> = {
  INVALID_TEAM_COUNT: [409, "CONFLICT"],
  INVALID_TEAMS: [409, "CONFLICT"],
  INVALID_RANDOM: [500, "INTERNAL"],
  MATCH_NOT_FOUND: [404, "NOT_FOUND"],
  INVALID_SCORE: [400, "VALIDATION"],
  MATCH_NOT_READY: [409, "CONFLICT"],
  LOCKED: [409, "CONFLICT"],
};

function mapEngineError(error: unknown): never {
  if (error instanceof BracketError) {
    const [status, code] = ENGINE_ERROR_STATUS[error.code];
    throw new TournamentBracketError(status, code, error.message);
  }
  throw error;
}

/** Khoá hàng giải (`FOR UPDATE`) và kiểm người gọi là BTC. */
async function lockTournamentForOrganizer(
  tx: Tx,
  slug: string,
  currentUserId: string,
): Promise<TournamentRow> {
  const [tournament] = await tx
    .select()
    .from(tournaments)
    .where(eq(tournaments.slug, slug))
    .for("update");

  if (!tournament) {
    throw new TournamentBracketError(404, "NOT_FOUND", "Không tìm thấy giải đấu");
  }
  if (tournament.organizerId !== currentUserId) {
    throw new TournamentBracketError(
      403,
      "FORBIDDEN",
      "Chỉ ban tổ chức mới có quyền thực hiện thao tác này",
    );
  }
  return tournament;
}

function toNode(row: MatchRow): MatchNode {
  return {
    id: row.id,
    round: row.round,
    position: row.position,
    teamA: row.teamAId,
    teamB: row.teamBId,
    scoreA: row.scoreA,
    scoreB: row.scoreB,
    winner: row.winnerTeamId,
    isBye: row.isBye,
    nextMatchId: row.nextMatchId,
    nextSlot: row.nextSlot as "a" | "b" | null,
  };
}

async function loadMatchRows(tx: Tx, tournamentId: string): Promise<MatchRow[]> {
  return tx
    .select()
    .from(bracketMatches)
    .where(eq(bracketMatches.tournamentId, tournamentId))
    .orderBy(asc(bracketMatches.round), asc(bracketMatches.position));
}

function totalRoundsOf(nodes: readonly MatchNode[]): number {
  return nodes.reduce((max, node) => Math.max(max, node.round), 0);
}

/**
 * Đóng đăng ký: schema không có cờ riêng nên dùng `registration_deadline`
 * (kéo hạn về thời điểm hiện tại). Luồng đăng ký từ chối khi đã quá hạn.
 */
export async function closeRegistration(
  db: DbClient,
  slug: string,
  currentUserId: string,
  now: Date,
): Promise<void> {
  await db.transaction(async (tx) => {
    const tournament = await lockTournamentForOrganizer(tx, slug, currentUserId);
    if (tournament.status !== "open") {
      throw new TournamentBracketError(
        409,
        "CONFLICT",
        "Chỉ đóng đăng ký được khi giải đang mở đăng ký",
      );
    }
    if (tournament.registrationDeadline.getTime() <= now.getTime()) {
      throw new TournamentBracketError(409, "CONFLICT", "Giải đã đóng đăng ký");
    }
    await tx
      .update(tournaments)
      .set({ registrationDeadline: now })
      .where(eq(tournaments.id, tournament.id));
  });
}

/** Bốc thăm (hoặc bốc lại khi chưa trận nào có tỉ số) bằng `planBracket`. */
export async function drawBracket(
  db: DbClient,
  slug: string,
  currentUserId: string,
  random: () => number = cryptoRandom,
): Promise<void> {
  await db.transaction(async (tx) => {
    const tournament = await lockTournamentForOrganizer(tx, slug, currentUserId);
    if (tournament.status === "finished") {
      throw new TournamentBracketError(409, "CONFLICT", "Giải đã kết thúc");
    }

    const existing = await loadMatchRows(tx, tournament.id);
    if (existing.some((m) => m.scoreA !== null || m.scoreB !== null)) {
      throw new TournamentBracketError(
        409,
        "CONFLICT",
        "Không thể bốc lại khi đã có trận được nhập tỉ số",
      );
    }

    const approved = await tx
      .select({ id: tournamentTeams.id })
      .from(tournamentTeams)
      .where(
        and(
          eq(tournamentTeams.tournamentId, tournament.id),
          eq(tournamentTeams.status, "approved"),
        ),
      )
      .orderBy(asc(tournamentTeams.seed), asc(tournamentTeams.createdAt));

    if (approved.length < 2) {
      throw new TournamentBracketError(
        409,
        "CONFLICT",
        "Cần ít nhất 2 đội đã duyệt để bốc thăm",
      );
    }

    let nodes: MatchNode[];
    try {
      nodes = planBracket(
        approved.map((t) => t.id),
        random,
      );
    } catch (error) {
      mapEngineError(error);
    }

    if (existing.length > 0) {
      await tx
        .delete(bracketMatches)
        .where(eq(bracketMatches.tournamentId, tournament.id));
    }

    const totalRounds = totalRoundsOf(nodes);
    await tx.insert(bracketMatches).values(
      nodes.map((node) => ({
        id: node.id,
        tournamentId: tournament.id,
        round: node.round,
        position: node.position,
        label: matchLabel(node.round, node.position, totalRounds),
        teamAId: node.teamA,
        teamBId: node.teamB,
        scoreA: node.scoreA,
        scoreB: node.scoreB,
        winnerTeamId: node.winner,
        isBye: node.isBye,
        scheduledAt: null,
        nextMatchId: node.nextMatchId,
        nextSlot: node.nextSlot,
      })),
    );

    await tx
      .update(tournaments)
      .set({ status: "live", championTeamId: null })
      .where(eq(tournaments.id, tournament.id));
  });
}

function nodeChanged(before: MatchNode | undefined, after: MatchNode): boolean {
  return (
    !before ||
    before.teamA !== after.teamA ||
    before.teamB !== after.teamB ||
    before.scoreA !== after.scoreA ||
    before.scoreB !== after.scoreB ||
    before.winner !== after.winner
  );
}

/** Nhập/sửa tỉ số bằng `recordScore`; thắng chung kết → giải `finished` + vô địch. */
export async function scoreMatch(
  db: DbClient,
  slug: string,
  matchId: string,
  body: ScoreMatchBody,
  currentUserId: string,
  now: Date,
): Promise<void> {
  await db.transaction(async (tx) => {
    const tournament = await lockTournamentForOrganizer(tx, slug, currentUserId);
    const rows = await loadMatchRows(tx, tournament.id);
    if (rows.length === 0) {
      throw new TournamentBracketError(409, "CONFLICT", "Giải chưa bốc thăm nhánh đấu");
    }

    const before = rows.map(toNode);
    let after: MatchNode[];
    try {
      after = recordScore(
        before,
        matchId,
        body.scoreA,
        body.scoreB,
        tournament.series as Series,
      );
    } catch (error) {
      mapEngineError(error);
    }

    const beforeById = new Map(before.map((n) => [n.id, n]));
    for (const node of after) {
      if (!nodeChanged(beforeById.get(node.id), node)) continue;
      await tx
        .update(bracketMatches)
        .set({
          teamAId: node.teamA,
          teamBId: node.teamB,
          scoreA: node.scoreA,
          scoreB: node.scoreB,
          winnerTeamId: node.winner,
        })
        .where(eq(bracketMatches.id, node.id));
    }

    const championId = championOf(after);
    if (championId === null || championId === tournament.championTeamId) {
      return;
    }

    await tx
      .update(tournaments)
      .set({ status: "finished", championTeamId: championId })
      .where(eq(tournaments.id, tournament.id));

    const [championTeam] = await tx
      .select({ name: tournamentTeams.name })
      .from(tournamentTeams)
      .where(eq(tournamentTeams.id, championId));

    const activityId = randomUUID();
    await tx.insert(activities).values({
      id: activityId,
      kind: "result",
      actorId: currentUserId,
      roomId: null,
      tournamentId: tournament.id,
      text: `Giải "${tournament.name}" đã kết thúc`,
      emphasis: `${championTeam?.name ?? "Đội thắng"} vô địch`,
      createdAt: now,
    });

    const teamIds = [
      ...new Set(after.flatMap((n) => [n.teamA, n.teamB]).filter((id) => id !== null)),
    ];
    const memberRows =
      teamIds.length > 0
        ? await tx
            .select({ userId: tournamentTeamMembers.userId })
            .from(tournamentTeamMembers)
            .where(
              and(
                inArray(tournamentTeamMembers.teamId, teamIds),
                eq(tournamentTeamMembers.active, true),
              ),
            )
        : [];
    const recipientIds = new Set([
      tournament.organizerId,
      ...memberRows.map((m) => m.userId),
    ]);
    await tx
      .insert(activityRecipients)
      .values([...recipientIds].map((userId) => ({ activityId, userId })));
  });
}

/** Xếp lịch một trận (`scheduled_at`). */
export async function scheduleMatch(
  db: DbClient,
  slug: string,
  matchId: string,
  body: ScheduleMatchBody,
  currentUserId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const tournament = await lockTournamentForOrganizer(tx, slug, currentUserId);
    const [match] = await tx
      .select()
      .from(bracketMatches)
      .where(
        and(
          eq(bracketMatches.id, matchId),
          eq(bracketMatches.tournamentId, tournament.id),
        ),
      );
    if (!match) {
      throw new TournamentBracketError(404, "NOT_FOUND", "Không tìm thấy trận đấu");
    }
    if (match.isBye) {
      throw new TournamentBracketError(409, "CONFLICT", "Không xếp lịch cho trận bye");
    }
    await tx
      .update(bracketMatches)
      .set({ scheduledAt: new Date(body.scheduledAt) })
      .where(eq(bracketMatches.id, match.id));
  });
}
