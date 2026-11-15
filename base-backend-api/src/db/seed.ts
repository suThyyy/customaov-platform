import { randomUUID } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { eq } from "drizzle-orm";

import { hashPassword } from "../auth/password.js";
import { loadConfig } from "../config.js";
import { closeDb, createDb, migrate, type DbClient } from "./client.js";
import {
  activities,
  activityRecipients,
  bracketMatches,
  roomMatches,
  roomMembers,
  roomMessages,
  rooms,
  sessions,
  tournamentTeamMembers,
  tournamentTeams,
  tournaments,
  users,
} from "./schema.js";
import { SEED_ACTIVITIES } from "./seed-data/activities.js";
import { SEED_USERS } from "./seed-data/players.js";
import { SEED_ROOMS } from "./seed-data/rooms.js";
import { normalizeVi } from "./seed-data/text.js";
import { SEED_TOURNAMENTS } from "./seed-data/tournaments.js";

export interface SeedOptions {
  nodeEnv?: string;
}

export async function seedDatabase(
  db: DbClient,
  options: SeedOptions = {},
): Promise<void> {
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV ?? "development";
  if (nodeEnv === "production") {
    throw new Error("Refusing to run database seed in production environment.");
  }

  const demoPasswordHash = await hashPassword("customaov123");

  await db.transaction(async (tx) => {
    // 1. Clean all tables in reverse dependency order
    await tx.delete(activityRecipients);
    await tx.delete(activities);
    await tx.delete(bracketMatches);
    await tx.delete(tournamentTeamMembers);
    await tx.delete(tournamentTeams);
    await tx.delete(tournaments);
    await tx.delete(roomMatches);
    await tx.delete(roomMessages);
    await tx.delete(roomMembers);
    await tx.delete(rooms);
    await tx.delete(sessions);
    await tx.delete(users);

    // 2. Seed users
    const userIdByUsername = new Map<string, string>();
    const nonSuthyUsernames: string[] = [];

    for (const u of SEED_USERS) {
      const id = randomUUID();
      userIdByUsername.set(u.username, id);
      if (u.username !== "suthy") {
        nonSuthyUsernames.push(u.username);
      }

      await tx.insert(users).values({
        id,
        uid: u.uid,
        username: u.username,
        displayName: u.displayName,
        passwordHash: demoPasswordHash,
        avatarUrl: u.avatarUrl,
        bio: u.bio,
        bioExtra: u.bioExtra,
        roleBadge: u.roleBadge,
        playerBadge: u.playerBadge,
        level: u.level,
        crowned: u.crowned,
        searchText: normalizeVi(`${u.username} ${u.displayName} ${u.uid}`),
      });
    }

    // 3. Seed rooms, members, messages
    const roomIdByCode = new Map<string, string>();

    for (const r of SEED_ROOMS) {
      const roomId = randomUUID();
      roomIdByCode.set(r.code, roomId);
      const hostId = userIdByUsername.get(r.hostUsername);
      if (!hostId) {
        throw new Error(`Missing seed host user: ${r.hostUsername}`);
      }

      const fullTitle = r.highlight ? `${r.title} – ${r.highlight}` : r.title;
      await tx.insert(rooms).values({
        id: roomId,
        code: r.code,
        title: r.title,
        highlight: r.highlight,
        thumbnail: r.thumbnail,
        hostId,
        mode: r.mode,
        visibility: r.visibility,
        capacity: r.capacity,
        status: r.status,
        config: r.config,
        joinKey: r.visibility === "private" ? `key-${r.code.toLowerCase()}` : null,
        lastSplit: null,
        searchText: normalizeVi(`${r.code} ${fullTitle}`),
      });

      for (const [idx, m] of r.members.entries()) {
        const userId = userIdByUsername.get(m.username);
        if (!userId) {
          throw new Error(`Missing seed member user: ${m.username}`);
        }
        await tx.insert(roomMembers).values({
          roomId,
          userId,
          role: "player",
          side: m.side,
          lane: m.lane,
          ready: m.ready,
          captain: m.captain,
          tier: null,
          position: idx,
        });
      }

      for (const msg of r.messages) {
        const authorId = msg.authorUsername
          ? (userIdByUsername.get(msg.authorUsername) ?? null)
          : null;
        await tx.insert(roomMessages).values({
          id: randomUUID(),
          roomId,
          authorId,
          text: msg.text,
          system: msg.system,
          createdAt: new Date(msg.createdAt),
        });
      }
    }

    // 4. Seed tournaments, teams, team members, bracket matches
    const tournamentIdBySlug = new Map<string, string>();

    for (const t of SEED_TOURNAMENTS) {
      const tournamentId = randomUUID();
      tournamentIdBySlug.set(t.slug, tournamentId);
      const organizerId = userIdByUsername.get(t.organizerUsername);
      if (!organizerId) {
        throw new Error(`Missing seed organizer user: ${t.organizerUsername}`);
      }

      await tx.insert(tournaments).values({
        id: tournamentId,
        slug: t.slug,
        name: t.name,
        titleAccent: t.titleAccent,
        description: t.description,
        intro: t.intro,
        organizerId,
        status: t.status,
        teamCount: t.teamCount,
        series: t.series,
        cover: t.cover,
        registrationDeadline: new Date(t.registrationDeadline),
        drawDate: new Date(t.drawDate),
        dateStart: new Date(t.dateStart),
        dateEnd: new Date(t.dateEnd),
        rules: t.rules,
        prizes: t.prizes,
        championTeamId: null,
        searchText: normalizeVi(`${t.name} ${t.description}`),
        createdAt: new Date(t.createdAt),
      });

      const teamIdByKey = new Map<string, string>();
      for (const [idx, teamDef] of t.teams.entries()) {
        const teamId = randomUUID();
        teamIdByKey.set(teamDef.key, teamId);
        // Assign distinct non-suthy captains so suthy is not registered in Ngũ Kiệt Cup
        const captainUsername =
          nonSuthyUsernames[idx % nonSuthyUsernames.length]!;
        const captainId = userIdByUsername.get(captainUsername)!;

        await tx.insert(tournamentTeams).values({
          id: teamId,
          tournamentId,
          name: teamDef.name,
          logo: teamDef.logo,
          captainId,
          status: "approved",
          rejectReason: null,
          seed: idx + 1,
        });

        await tx.insert(tournamentTeamMembers).values({
          teamId,
          userId: captainId,
          tournamentId,
          isSub: false,
        });
      }

      const matchIdByCoord = new Map<string, string>();
      for (const m of t.bracket) {
        matchIdByCoord.set(`${m.round}:${m.position}`, randomUUID());
      }

      for (const m of t.bracket) {
        const matchId = matchIdByCoord.get(`${m.round}:${m.position}`)!;
        const nextMatchId =
          m.nextSlot !== null
            ? (matchIdByCoord.get(
                `${m.round + 1}:${Math.floor(m.position / 2)}`,
              ) ?? null)
            : null;

        await tx.insert(bracketMatches).values({
          id: matchId,
          tournamentId,
          round: m.round,
          position: m.position,
          label: m.label,
          teamAId: m.teamAKey ? (teamIdByKey.get(m.teamAKey) ?? null) : null,
          teamBId: m.teamBKey ? (teamIdByKey.get(m.teamBKey) ?? null) : null,
          scoreA: m.scoreA,
          scoreB: m.scoreB,
          winnerTeamId: m.winnerKey
            ? (teamIdByKey.get(m.winnerKey) ?? null)
            : null,
          scheduledAt: m.scheduledAt ? new Date(m.scheduledAt) : null,
          nextMatchId,
          nextSlot: m.nextSlot,
        });
      }

      if (t.championTeamKey) {
        const championTeamId = teamIdByKey.get(t.championTeamKey) ?? null;
        if (championTeamId) {
          await tx
            .update(tournaments)
            .set({ championTeamId })
            .where(eq(tournaments.id, tournamentId));
        }
      }
    }

    // 5. Seed activities and recipients
    for (const act of SEED_ACTIVITIES) {
      const activityId = randomUUID();
      const actorId = userIdByUsername.get(act.actorUsername) ?? null;
      const roomId = act.roomCode
        ? (roomIdByCode.get(act.roomCode) ?? null)
        : null;
      const tournamentId = act.tournamentSlug
        ? (tournamentIdBySlug.get(act.tournamentSlug) ?? null)
        : null;

      await tx.insert(activities).values({
        id: activityId,
        kind: act.kind,
        actorId,
        roomId,
        tournamentId,
        text: act.text,
        emphasis: act.emphasis,
        createdAt: new Date(act.createdAt),
      });

      for (const recipientUsername of act.recipientUsernames) {
        const userId = userIdByUsername.get(recipientUsername);
        if (userId) {
          await tx.insert(activityRecipients).values({
            activityId,
            userId,
          });
        }
      }
    }
  });
}

const isCliEntrypoint =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isCliEntrypoint) {
  const config = loadConfig();
  const db = createDb(config.DATABASE_URL);
  try {
    await migrate(db);
    await seedDatabase(db, { nodeEnv: config.NODE_ENV });
    console.log(`Database seeded (${config.DATABASE_URL})`);
  } finally {
    await closeDb(db);
  }
}
