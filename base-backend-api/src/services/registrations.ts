import { randomUUID } from "node:crypto";
import type {
  CreateRegistrationBody,
  ErrorCode,
  Me,
  Registration,
  RejectRegistrationBody,
  UserSummary,
} from "@customaov/contracts";
import { and, asc, eq, inArray, sql } from "drizzle-orm";

import type { DbClient } from "../db/client.js";
import {
  activities,
  activityRecipients,
  tournamentTeamMembers,
  tournamentTeams,
  tournaments,
  users,
} from "../db/schema.js";
import type { DbOrTx } from "./rooms.js";

/** Logo mặc định cho đội mới đăng ký (chưa có upload logo ở MVP). */
export const DEFAULT_TEAM_LOGO = "/mock-assets/logo.png";

const ACTIVE_MEMBER_INDEX = "tournament_team_members_active_uidx";
const TEAM_NAME_INDEX = "tournament_teams_tournament_id_lower_name_uidx";

export class RegistrationServiceError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

type TournamentRow = typeof tournaments.$inferSelect;
type TeamRow = typeof tournamentTeams.$inferSelect;
type UserRow = typeof users.$inferSelect;

function conflict(message: string): RegistrationServiceError {
  return new RegistrationServiceError(409, "CONFLICT", message);
}

function extractPgError(err: unknown): { code?: string; constraint?: string } {
  let current: unknown = err;
  for (let i = 0; i < 4 && typeof current === "object" && current !== null; i++) {
    const rec = current as Record<string, unknown>;
    if (typeof rec.code === "string") {
      return {
        code: rec.code,
        ...(typeof rec.constraint === "string" ? { constraint: rec.constraint } : {}),
      };
    }
    current = rec.cause;
  }
  return {};
}

function uniqueViolation(err: unknown): string | null {
  const info = extractPgError(err);
  if (info.code !== "23505") return null;
  return info.constraint ?? "";
}

function toUserSummary(row: UserRow): UserSummary {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    level: row.level,
    crowned: row.crowned,
  };
}

/** Khoá hàng giải (SELECT … FOR UPDATE) theo slug. 404 nếu không có. */
async function lockTournament(tx: DbOrTx, slug: string): Promise<TournamentRow> {
  const [row] = await tx
    .select()
    .from(tournaments)
    .where(eq(tournaments.slug, slug))
    .for("update");
  if (!row) {
    throw new RegistrationServiceError(404, "NOT_FOUND", "Không tìm thấy giải đấu");
  }
  return row;
}

async function findTournament(db: DbOrTx, slug: string): Promise<TournamentRow> {
  const [row] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.slug, slug))
    .limit(1);
  if (!row) {
    throw new RegistrationServiceError(404, "NOT_FOUND", "Không tìm thấy giải đấu");
  }
  return row;
}

function requireOrganizer(tournament: TournamentRow, userId: string): void {
  if (tournament.organizerId !== userId) {
    throw new RegistrationServiceError(
      403,
      "FORBIDDEN",
      "Chỉ ban tổ chức mới được quản lý đăng ký",
    );
  }
}

function requireOpen(tournament: TournamentRow, action: string): void {
  if (tournament.status !== "open") {
    throw conflict(`Giải đã đóng đăng ký, không thể ${action}`);
  }
}

async function countApproved(tx: DbOrTx, tournamentId: string): Promise<number> {
  const [row] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(tournamentTeams)
    .where(
      and(
        eq(tournamentTeams.tournamentId, tournamentId),
        eq(tournamentTeams.status, "approved"),
      ),
    );
  return row?.count ?? 0;
}

async function findTeam(
  tx: DbOrTx,
  tournamentId: string,
  teamId: string,
): Promise<TeamRow> {
  const [team] = await tx
    .select()
    .from(tournamentTeams)
    .where(and(eq(tournamentTeams.id, teamId), eq(tournamentTeams.tournamentId, tournamentId)))
    .limit(1);
  if (!team) {
    throw new RegistrationServiceError(404, "NOT_FOUND", "Không tìm thấy đơn đăng ký");
  }
  return team;
}

/** Tên hiển thị của những người (trong `userIds`) đã có đội active trong giải. */
async function activeMemberNames(
  db: DbOrTx,
  tournamentId: string,
  userIds: string[],
): Promise<string[]> {
  if (userIds.length === 0) return [];
  const rows = await db
    .select({ displayName: users.displayName, username: users.username })
    .from(tournamentTeamMembers)
    .innerJoin(users, eq(tournamentTeamMembers.userId, users.id))
    .where(
      and(
        eq(tournamentTeamMembers.tournamentId, tournamentId),
        eq(tournamentTeamMembers.active, true),
        inArray(tournamentTeamMembers.userId, userIds),
      ),
    );
  return rows.map((r) => `${r.displayName} (@${r.username})`);
}

function memberConflict(names: string[]): RegistrationServiceError {
  return conflict(`Đã có đội trong giải này: ${names.join(", ")}`);
}

function teamNameConflict(name: string): RegistrationServiceError {
  return conflict(`Tên đội "${name}" đã được dùng trong giải này`);
}

async function loadRegistrations(db: DbOrTx, teams: TeamRow[]): Promise<Registration[]> {
  if (teams.length === 0) return [];
  const memberRows = await db
    .select({ teamId: tournamentTeamMembers.teamId, isSub: tournamentTeamMembers.isSub, user: users })
    .from(tournamentTeamMembers)
    .innerJoin(users, eq(tournamentTeamMembers.userId, users.id))
    .where(inArray(tournamentTeamMembers.teamId, teams.map((t) => t.id)));

  const byTeam = new Map<string, { members: UserSummary[]; subs: UserSummary[]; captain?: UserSummary }>();
  for (const team of teams) byTeam.set(team.id, { members: [], subs: [] });
  for (const row of memberRows) {
    const entry = byTeam.get(row.teamId);
    if (!entry) continue;
    (row.isSub ? entry.subs : entry.members).push(toUserSummary(row.user));
  }

  const result: Registration[] = [];
  for (const team of teams) {
    const entry = byTeam.get(team.id)!;
    // Đội trưởng đứng đầu danh sách thành viên chính.
    entry.members.sort((a, b) => Number(b.id === team.captainId) - Number(a.id === team.captainId));
    // Đội seed cũ chỉ có đội trưởng (không đủ 5 người) → không khớp RegistrationSchema; bỏ qua.
    if (entry.members.length !== 5 || entry.subs.length > 2) continue;
    result.push({
      id: team.id,
      teamName: team.name,
      members: entry.members,
      subs: entry.subs,
      status: team.status as Registration["status"],
      rejectReason: team.rejectReason,
      createdAt: team.createdAt.toISOString(),
    });
  }
  return result;
}

async function loadRegistration(db: DbOrTx, team: TeamRow): Promise<Registration> {
  const [registration] = await loadRegistrations(db, [team]);
  if (!registration) {
    throw new RegistrationServiceError(
      409,
      "CONFLICT",
      "Đơn đăng ký không đủ thành viên để hiển thị",
    );
  }
  return registration;
}

async function recordActivity(
  tx: DbOrTx,
  input: {
    actorId: string;
    tournament: TournamentRow;
    text: string;
    emphasis: string | null;
    recipientIds: string[];
    now: Date;
  },
): Promise<void> {
  const activityId = randomUUID();
  await tx.insert(activities).values({
    id: activityId,
    kind: "register",
    actorId: input.actorId,
    roomId: null,
    tournamentId: input.tournament.id,
    text: input.text,
    emphasis: input.emphasis,
    createdAt: input.now,
  });
  const recipients = [...new Set(input.recipientIds)];
  await tx
    .insert(activityRecipients)
    .values(recipients.map((userId) => ({ activityId, userId })));
}

export async function createRegistration(
  db: DbClient,
  slug: string,
  body: CreateRegistrationBody,
  currentUser: Me,
  now: Date,
): Promise<Registration> {
  const teamName = body.teamName.trim();
  const subs = body.subs ?? [];

  if (!body.members.includes(currentUser.username)) {
    throw new RegistrationServiceError(
      400,
      "VALIDATION",
      "Bạn phải là một trong 5 thành viên chính (đội trưởng) của đội",
    );
  }

  let tournamentId: string | null = null;
  let memberIds: string[] = [];
  try {
    return await db.transaction(async (tx) => {
      const tournament = await lockTournament(tx, slug);
      tournamentId = tournament.id;
      requireOpen(tournament, "đăng ký");
      if (now.getTime() > tournament.registrationDeadline.getTime()) {
        throw conflict("Đã quá hạn đăng ký giải này");
      }
      if ((await countApproved(tx, tournament.id)) >= tournament.teamCount) {
        throw conflict("Giải đã đủ đội");
      }

      const usernames = [...body.members, ...subs];
      const userRows = await tx.select().from(users).where(inArray(users.username, usernames));
      const byUsername = new Map(userRows.map((u) => [u.username, u]));
      const missing = usernames.filter((u) => !byUsername.has(u));
      if (missing.length > 0) {
        throw new RegistrationServiceError(
          400,
          "VALIDATION",
          `Không tìm thấy người chơi: ${missing.join(", ")}`,
        );
      }
      memberIds = usernames.map((u) => byUsername.get(u)!.id);

      const busy = await activeMemberNames(tx, tournament.id, memberIds);
      if (busy.length > 0) throw memberConflict(busy);

      const [sameName] = await tx
        .select({ id: tournamentTeams.id })
        .from(tournamentTeams)
        .where(
          and(
            eq(tournamentTeams.tournamentId, tournament.id),
            sql`lower(${tournamentTeams.name}) = lower(${teamName})`,
          ),
        )
        .limit(1);
      if (sameName) throw teamNameConflict(teamName);

      const [team] = await tx
        .insert(tournamentTeams)
        .values({
          id: randomUUID(),
          tournamentId: tournament.id,
          name: teamName,
          logo: DEFAULT_TEAM_LOGO,
          captainId: currentUser.id,
          status: "pending",
          rejectReason: null,
          seed: null,
          createdAt: now,
        })
        .returning();

      await tx.insert(tournamentTeamMembers).values(
        usernames.map((username, index) => ({
          teamId: team!.id,
          userId: byUsername.get(username)!.id,
          tournamentId: tournament.id,
          isSub: index >= body.members.length,
          active: true,
        })),
      );

      await recordActivity(tx, {
        actorId: currentUser.id,
        tournament,
        text: `Đăng ký đội "${teamName}" vào giải "${tournament.name}"`,
        emphasis: "Chờ duyệt",
        recipientIds: [currentUser.id, tournament.organizerId],
        now,
      });

      return loadRegistration(tx, team!);
    });
  } catch (err) {
    // Hai đơn chạy song song (Postgres): partial unique index chặn ở mức CSDL.
    const constraint = uniqueViolation(err);
    if (constraint === null || tournamentId === null) throw err;
    if (constraint === TEAM_NAME_INDEX) throw teamNameConflict(teamName);
    if (constraint === ACTIVE_MEMBER_INDEX) {
      const names = await activeMemberNames(db, tournamentId, memberIds);
      throw names.length > 0 ? memberConflict(names) : conflict("Có thành viên đã có đội trong giải này");
    }
    throw err;
  }
}

export async function listRegistrations(
  db: DbClient,
  slug: string,
  currentUserId: string,
): Promise<Registration[]> {
  const tournament = await findTournament(db, slug);
  requireOrganizer(tournament, currentUserId);
  const teams = await db
    .select()
    .from(tournamentTeams)
    .where(eq(tournamentTeams.tournamentId, tournament.id))
    .orderBy(asc(tournamentTeams.createdAt), asc(tournamentTeams.id));
  return loadRegistrations(db, teams);
}

export async function approveRegistration(
  db: DbClient,
  slug: string,
  teamId: string,
  currentUserId: string,
  now: Date,
): Promise<Registration> {
  return db.transaction(async (tx) => {
    const tournament = await lockTournament(tx, slug);
    requireOrganizer(tournament, currentUserId);
    requireOpen(tournament, "duyệt đội");
    const team = await findTeam(tx, tournament.id, teamId);
    if (team.status !== "pending") {
      throw conflict("Chỉ duyệt được đơn đang chờ duyệt");
    }
    if ((await countApproved(tx, tournament.id)) >= tournament.teamCount) {
      throw conflict("Giải đã đủ đội, không thể duyệt thêm");
    }
    const [updated] = await tx
      .update(tournamentTeams)
      .set({ status: "approved", rejectReason: null })
      .where(eq(tournamentTeams.id, team.id))
      .returning();

    await recordActivity(tx, {
      actorId: currentUserId,
      tournament,
      text: `Đội "${team.name}" đã được duyệt vào giải "${tournament.name}"`,
      emphasis: "Đã duyệt",
      recipientIds: [team.captainId, tournament.organizerId],
      now,
    });
    return loadRegistration(tx, updated!);
  });
}

export async function rejectRegistration(
  db: DbClient,
  slug: string,
  teamId: string,
  body: RejectRegistrationBody,
  currentUserId: string,
  now: Date,
): Promise<Registration> {
  const reason = body.reason?.trim() || null;
  return db.transaction(async (tx) => {
    const tournament = await lockTournament(tx, slug);
    requireOrganizer(tournament, currentUserId);
    requireOpen(tournament, "từ chối đội");
    const team = await findTeam(tx, tournament.id, teamId);
    if (team.status !== "pending" && team.status !== "approved") {
      throw conflict("Đơn này đã bị từ chối hoặc đã rút");
    }
    const [updated] = await tx
      .update(tournamentTeams)
      .set({ status: "rejected", rejectReason: reason })
      .where(eq(tournamentTeams.id, team.id))
      .returning();
    await tx
      .update(tournamentTeamMembers)
      .set({ active: false })
      .where(eq(tournamentTeamMembers.teamId, team.id));

    await recordActivity(tx, {
      actorId: currentUserId,
      tournament,
      text: `Đội "${team.name}" bị từ chối ở giải "${tournament.name}"`,
      emphasis: reason,
      recipientIds: [team.captainId, tournament.organizerId],
      now,
    });
    return loadRegistration(tx, updated!);
  });
}

export async function withdrawRegistration(
  db: DbClient,
  slug: string,
  teamId: string,
  currentUserId: string,
  now: Date,
): Promise<void> {
  await db.transaction(async (tx) => {
    const tournament = await lockTournament(tx, slug);
    const team = await findTeam(tx, tournament.id, teamId);
    if (team.captainId !== currentUserId) {
      throw new RegistrationServiceError(
        403,
        "FORBIDDEN",
        "Chỉ đội trưởng mới được rút đăng ký",
      );
    }
    requireOpen(tournament, "rút đăng ký");
    if (team.status !== "pending" && team.status !== "approved") {
      throw conflict("Đơn này đã bị từ chối hoặc đã rút");
    }
    await tx
      .update(tournamentTeams)
      .set({ status: "withdrawn" })
      .where(eq(tournamentTeams.id, team.id));
    await tx
      .update(tournamentTeamMembers)
      .set({ active: false })
      .where(eq(tournamentTeamMembers.teamId, team.id));

    await recordActivity(tx, {
      actorId: currentUserId,
      tournament,
      text: `Đội "${team.name}" đã rút khỏi giải "${tournament.name}"`,
      emphasis: null,
      recipientIds: [team.captainId, tournament.organizerId],
      now,
    });
  });
}
