import {
  normalizeVi,
  type Registration,
  type Series,
  type Team,
  type TeamCount,
  type TournamentDetail,
  type TournamentsQuery,
  type TournamentsResponse,
  type TournamentStatus,
  type TournamentSummary,
  type UserSummary,
} from "@customaov/contracts";
import { and, asc, desc, eq, ilike, inArray, sql, type SQL } from "drizzle-orm";

import type { DbClient } from "../db/client.js";
import {
  bracketMatches,
  tournaments,
  tournamentTeamMembers,
  tournamentTeams,
  users,
} from "../db/schema.js";
import { derive, type MatchNode } from "./bracket/index.js";

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const HERO_TOURNAMENT_IMAGE = "/mock-assets/hero-tournament.jpg";

function toVnParts(date: Date): {
  dd: string;
  mm: string;
  hh: string;
  min: string;
} {
  const vn = new Date(date.getTime() + VN_OFFSET_MS);
  return {
    dd: String(vn.getUTCDate()).padStart(2, "0"),
    mm: String(vn.getUTCMonth() + 1).padStart(2, "0"),
    hh: String(vn.getUTCHours()).padStart(2, "0"),
    min: String(vn.getUTCMinutes()).padStart(2, "0"),
  };
}

function formatVnDate(date: Date): string {
  const { dd, mm } = toVnParts(date);
  return `${dd}/${mm}`;
}

function formatVnDateTimeComma(date: Date): string {
  const { dd, mm, hh, min } = toVnParts(date);
  return `${dd}/${mm}, ${hh}:${min}`;
}

function formatCover(cover: string): string {
  if (cover.startsWith("/") || cover.startsWith("http://") || cover.startsWith("https://")) {
    return cover;
  }
  return `/mock-assets/${cover}.jpg`;
}

function deriveTitleIcon(
  teamCount: number,
  series: Series,
): TournamentSummary["titleIcon"] {
  if (teamCount === 16) {
    return "laurel";
  }
  if (series === "BO1") {
    return "flag";
  }
  return "trophy";
}

function splitTitle(
  name: string,
  titleAccent: string | null,
): { title: string; titleAccent?: string } {
  if (!titleAccent) {
    return { title: name };
  }
  if (name.endsWith(titleAccent)) {
    const stripped = name.slice(0, name.length - titleAccent.length).trimEnd();
    if (stripped.length > 0) {
      return { title: stripped, titleAccent };
    }
  }
  return { title: name, titleAccent };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

function buildSummary(
  row: typeof tournaments.$inferSelect,
  organizerDisplayName: string,
  approvedTeamCount?: number,
): TournamentSummary {
  const status = row.status as TournamentStatus;
  const series = row.series as Series;
  const teamCount = row.teamCount as TeamCount;
  const dateRange = `${formatVnDate(row.dateStart)} – ${formatVnDate(row.dateEnd)}`;
  const timeLabel =
    status === "open"
      ? `Hạn đăng ký: ${formatVnDateTimeComma(row.registrationDeadline)}`
      : `Thời gian: ${dateRange}`;

  return {
    slug: row.slug,
    name: row.name,
    titleIcon: deriveTitleIcon(teamCount, series),
    cover: formatCover(row.cover),
    status,
    format: `5v5 – ${series}`,
    organizer: organizerDisplayName,
    description: row.description,
    teamCount,
    ...(status === "open" ? { registeredTeams: approvedTeamCount ?? 0 } : {}),
    registrationDeadline: row.registrationDeadline.toISOString(),
    drawDate: row.drawDate.toISOString(),
    dateStart: row.dateStart.toISOString(),
    dateEnd: row.dateEnd.toISOString(),
    createdAt: row.createdAt.toISOString(),
    timeLabel,
    dateRange,
  };
}

function toUserSummary(row: typeof users.$inferSelect): UserSummary {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    level: row.level,
    crowned: row.crowned,
  };
}

export async function listTournaments(
  db: DbClient,
  query: TournamentsQuery,
): Promise<TournamentsResponse> {
  const conditions: SQL[] = [];

  if (query.status) {
    conditions.push(eq(tournaments.status, query.status));
  }

  const trimmedQuery = query.q?.trim();
  if (trimmedQuery) {
    const normalized = normalizeVi(trimmedQuery);
    if (normalized.length > 0) {
      conditions.push(ilike(tournaments.searchText, `%${escapeLike(normalized)}%`));
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [countRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(tournaments)
    .where(whereClause);
  const total = countRow?.total ?? 0;

  const orderBy =
    query.sort === "deadline"
      ? [asc(tournaments.registrationDeadline), desc(tournaments.createdAt), asc(tournaments.id)]
      : [desc(tournaments.createdAt), asc(tournaments.id)];

  const offset = (query.page - 1) * query.pageSize;

  const rows = await db
    .select({
      tournament: tournaments,
      organizerName: users.displayName,
    })
    .from(tournaments)
    .innerJoin(users, eq(tournaments.organizerId, users.id))
    .where(whereClause)
    .orderBy(...orderBy)
    .limit(query.pageSize)
    .offset(offset);

  const openTournamentIds = rows
    .filter((r) => r.tournament.status === "open")
    .map((r) => r.tournament.id);

  const approvedCountsByTournament = new Map<string, number>();
  if (openTournamentIds.length > 0) {
    const counts = await db
      .select({
        tournamentId: tournamentTeams.tournamentId,
        count: sql<number>`count(*)::int`,
      })
      .from(tournamentTeams)
      .where(
        and(
          inArray(tournamentTeams.tournamentId, openTournamentIds),
          eq(tournamentTeams.status, "approved"),
        ),
      )
      .groupBy(tournamentTeams.tournamentId);

    for (const c of counts) {
      approvedCountsByTournament.set(c.tournamentId, c.count);
    }
  }

  const items = rows.map((r) =>
    buildSummary(
      r.tournament,
      r.organizerName,
      approvedCountsByTournament.get(r.tournament.id),
    ),
  );

  return {
    items,
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function getTournamentBySlug(
  db: DbClient,
  slug: string,
  viewerUserId: string | null,
): Promise<TournamentDetail | null> {
  const [row] = await db
    .select({
      tournament: tournaments,
      organizerName: users.displayName,
    })
    .from(tournaments)
    .innerJoin(users, eq(tournaments.organizerId, users.id))
    .where(eq(tournaments.slug, slug))
    .limit(1);

  if (!row) {
    return null;
  }

  const t = row.tournament;

  const approvedTeamRows = await db
    .select()
    .from(tournamentTeams)
    .where(
      and(
        eq(tournamentTeams.tournamentId, t.id),
        eq(tournamentTeams.status, "approved"),
      ),
    )
    .orderBy(asc(tournamentTeams.seed), asc(tournamentTeams.createdAt));

  const teamList: Team[] = approvedTeamRows.map((team) => ({
    id: team.id,
    name: team.name,
    logo: team.logo,
  }));

  const matchRows = await db
    .select()
    .from(bracketMatches)
    .where(eq(bracketMatches.tournamentId, t.id))
    .orderBy(asc(bracketMatches.round), asc(bracketMatches.position));

  const nodes: MatchNode[] = matchRows.map((m) => ({
    id: m.id,
    round: m.round,
    position: m.position,
    teamA: m.teamAId,
    teamB: m.teamBId,
    scoreA: m.scoreA,
    scoreB: m.scoreB,
    winner: m.winnerTeamId,
    isBye: m.isBye,
    nextMatchId: m.nextMatchId,
    nextSlot: m.nextSlot as "a" | "b" | null,
  }));

  const schedule = new Map<string, Date | null>(
    matchRows.map((m) => [m.id, m.scheduledAt]),
  );

  const series = t.series as Series;
  const derived = derive(nodes, teamList, schedule, { series });

  let myRole: TournamentDetail["myRole"] = null;
  let myRegistration: Registration | null = null;

  if (viewerUserId) {
    if (t.organizerId === viewerUserId) {
      myRole = "organizer";
    }

    const [activeMembership] = await db
      .select({
        team: tournamentTeams,
      })
      .from(tournamentTeamMembers)
      .innerJoin(
        tournamentTeams,
        eq(tournamentTeamMembers.teamId, tournamentTeams.id),
      )
      .where(
        and(
          eq(tournamentTeamMembers.tournamentId, t.id),
          eq(tournamentTeamMembers.userId, viewerUserId),
          eq(tournamentTeamMembers.active, true),
        ),
      )
      .limit(1);

    let registrationTeam: typeof tournamentTeams.$inferSelect | undefined =
      activeMembership?.team;

    if (registrationTeam) {
      if (myRole === null) {
        myRole =
          registrationTeam.captainId === viewerUserId ? "captain" : "member";
      }
    } else {
      const [captainTeam] = await db
        .select()
        .from(tournamentTeams)
        .where(
          and(
            eq(tournamentTeams.tournamentId, t.id),
            eq(tournamentTeams.captainId, viewerUserId),
          ),
        )
        .orderBy(desc(tournamentTeams.createdAt))
        .limit(1);
      registrationTeam = captainTeam;
    }

    if (registrationTeam) {
      const memberRows = await db
        .select({
          isSub: tournamentTeamMembers.isSub,
          user: users,
        })
        .from(tournamentTeamMembers)
        .innerJoin(users, eq(tournamentTeamMembers.userId, users.id))
        .where(eq(tournamentTeamMembers.teamId, registrationTeam.id));

      const mainMembers = memberRows
        .filter((m) => !m.isSub)
        .map((m) => toUserSummary(m.user));
      const subs = memberRows
        .filter((m) => m.isSub)
        .map((m) => toUserSummary(m.user));

      if (mainMembers.length === 5 && subs.length <= 2) {
        myRegistration = {
          id: registrationTeam.id,
          teamName: registrationTeam.name,
          members: mainMembers,
          subs,
          status: registrationTeam.status as Registration["status"],
          rejectReason: registrationTeam.rejectReason,
          createdAt: registrationTeam.createdAt.toISOString(),
        };
      }
    }
  }

  const summary = buildSummary(t, row.organizerName, teamList.length);
  const { title, titleAccent } = splitTitle(t.name, t.titleAccent);

  return {
    ...summary,
    title,
    ...(titleAccent !== undefined ? { titleAccent } : {}),
    intro: t.intro,
    mode: "5v5 • Custom",
    category:
      t.teamCount === 16
        ? "Giải cộng đồng"
        : series === "BO1"
          ? "Fun Cup"
          : "Giải đấu Custom",
    formatLabel:
      t.teamCount === 16
        ? `Loại trực tiếp 16 đội (${series})`
        : `Loại trực tiếp (${series})`,
    series,
    heroImage: HERO_TOURNAMENT_IMAGE,
    rules: t.rules,
    prizes: t.prizes,
    teamList,
    bracket: derived.bracket,
    upcoming: derived.upcoming,
    results: derived.results,
    champion: derived.champion,
    myRole,
    myRegistration,
  };
}
