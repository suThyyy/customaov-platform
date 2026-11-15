import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { verifyPassword } from "../auth/password.js";
import { closeDb, createDb, migrate, type DbClient } from "./client.js";
import {
  bracketMatches,
  roomMembers,
  roomMessages,
  rooms,
  tournamentTeams,
  tournaments,
  users,
} from "./schema.js";
import { seedDatabase } from "./seed.js";

const dbs: DbClient[] = [];

async function setupSeededMemoryDb(): Promise<DbClient> {
  const db = createDb("memory://");
  dbs.push(db);
  await migrate(db);
  await seedDatabase(db, { nodeEnv: "test" });
  return db;
}

afterEach(async () => {
  await Promise.all(dbs.splice(0).map((db) => closeDb(db)));
});

describe("database schema, migration, and seed", () => {
  it("migrates and seeds idempotently with expected mock counts", async () => {
    const db = await setupSeededMemoryDb();
    // Second run should be idempotent
    await seedDatabase(db, { nodeEnv: "test" });

    const allUsers = await db.select().from(users);
    const allRooms = await db.select().from(rooms);
    const allTournaments = await db.select().from(tournaments);
    const allMessages = await db.select().from(roomMessages);

    expect(allUsers.length).toBeGreaterThanOrEqual(10);
    expect(allRooms).toHaveLength(5);
    expect(allTournaments).toHaveLength(8);
    expect(allMessages).toHaveLength(6);
  });

  it("places suthy only in room AOV-1024 and seeds demo password hash", async () => {
    const db = await setupSeededMemoryDb();

    const [suthy] = await db
      .select()
      .from(users)
      .where(eq(users.username, "suthy"));
    expect(suthy).toBeDefined();
    expect(suthy?.uid).toBe("102394");
    expect(suthy?.bio).toBe("Custom vui là chính");

    expect(await verifyPassword("customaov123", suthy!.passwordHash)).toBe(
      true,
    );
    expect(await verifyPassword("wrongpass", suthy!.passwordHash)).toBe(false);

    const suthyMemberships = await db
      .select({ code: rooms.code })
      .from(roomMembers)
      .innerJoin(rooms, eq(roomMembers.roomId, rooms.id))
      .where(eq(roomMembers.userId, suthy!.id));

    expect(suthyMemberships).toEqual([{ code: "AOV-1024" }]);
  });

  it("seeds 10 players in every live room", async () => {
    const db = await setupSeededMemoryDb();

    const liveRooms = await db
      .select()
      .from(rooms)
      .where(eq(rooms.status, "live"));
    expect(liveRooms.length).toBeGreaterThan(0);

    for (const room of liveRooms) {
      const members = await db
        .select()
        .from(roomMembers)
        .where(eq(roomMembers.roomId, room.id));
      expect(members).toHaveLength(10);
    }
  });

  it("seeds Ngũ Kiệt Cup with 11 teams and no bracket, and Hội Làng with Ngũ Hổ champion", async () => {
    const db = await setupSeededMemoryDb();

    const [nguKiet] = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.slug, "ngu-kiet-cup-mua-1"));
    expect(nguKiet).toBeDefined();

    const nguKietTeams = await db
      .select()
      .from(tournamentTeams)
      .where(eq(tournamentTeams.tournamentId, nguKiet!.id));
    expect(nguKietTeams).toHaveLength(11);

    const nguKietBracket = await db
      .select()
      .from(bracketMatches)
      .where(eq(bracketMatches.tournamentId, nguKiet!.id));
    expect(nguKietBracket).toHaveLength(0);

    const [hoiLang] = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.slug, "hoi-lang-keo-vui"));
    expect(hoiLang?.championTeamId).toBeTruthy();

    const [champion] = await db
      .select()
      .from(tournamentTeams)
      .where(eq(tournamentTeams.id, hoiLang!.championTeamId!));
    expect(champion?.name).toBe("Ngũ Hổ");
  });

  it("enforces unique username and case-insensitive unique team name per tournament", async () => {
    const db = await setupSeededMemoryDb();

    await expect(
      db.insert(users).values({
        id: randomUUID(),
        uid: "999999",
        username: "suthy",
        displayName: "Duplicate",
        passwordHash: "scrypt$32768$8$1$00$00",
        searchText: "duplicate",
      }),
    ).rejects.toThrow();

    const [nguKiet] = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.slug, "ngu-kiet-cup-mua-1"));
    const [vanhh] = await db
      .select()
      .from(users)
      .where(eq(users.username, "vanhh"));

    await expect(
      db.insert(tournamentTeams).values({
        id: randomUUID(),
        tournamentId: nguKiet!.id,
        name: "team xanh",
        logo: "/mock-assets/team-xanh.png",
        captainId: vanhh!.id,
        status: "pending",
      }),
    ).rejects.toThrow();
  });

  it("refuses to seed when NODE_ENV is production", async () => {
    const db = createDb("memory://");
    dbs.push(db);
    await migrate(db);

    await expect(
      seedDatabase(db, { nodeEnv: "production" }),
    ).rejects.toThrow(/production/i);
  });
});
