import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { verifyPassword } from "../auth/password.js";
import {
  closeDb,
  createDb,
  formatDatabaseTarget,
  migrate,
  type DbClient,
} from "./client.js";
import {
  activities,
  bracketMatches,
  roomMembers,
  roomMessages,
  rooms,
  tournamentTeamMembers,
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

  it("enforces CHECK constraints on uid format and enum columns", async () => {
    const db = await setupSeededMemoryDb();
    const [suthy] = await db
      .select()
      .from(users)
      .where(eq(users.username, "suthy"));
    const [room] = await db
      .select()
      .from(rooms)
      .where(eq(rooms.code, "AOV-1024"));
    const [nguKiet] = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.slug, "ngu-kiet-cup-mua-1"));
    const [vanhh] = await db
      .select()
      .from(users)
      .where(eq(users.username, "vanhh"));
    const [linh] = await db
      .select()
      .from(users)
      .where(eq(users.username, "linh"));

    // users.uid ~ '^[0-9]{6}$'
    await expect(
      db.insert(users).values({
        id: randomUUID(),
        uid: "12345",
        username: "bad_uid",
        displayName: "Bad UID",
        passwordHash: "scrypt$32768$8$1$00$00",
        searchText: "bad uid",
      }),
    ).rejects.toThrow();

    // room_members.role & room_members.side
    await expect(
      db.insert(roomMembers).values({
        roomId: room!.id,
        userId: linh!.id,
        role: "admin",
        side: "blue",
      }),
    ).rejects.toThrow();
    await expect(
      db.insert(roomMembers).values({
        roomId: room!.id,
        userId: linh!.id,
        role: "player",
        side: "green",
      }),
    ).rejects.toThrow();

    // rooms.mode, visibility, status
    await expect(
      db.insert(rooms).values({
        id: randomUUID(),
        code: "AOV-9991",
        title: "Bad Mode",
        thumbnail: "/mock-assets/room-1.jpg",
        hostId: suthy!.id,
        mode: "ranked",
        visibility: "public",
        status: "waiting",
        config: {
          format: "5v5",
          pickMode: "draft",
          series: "BO1",
          tools: [],
          notes: "",
        },
        searchText: "bad mode",
      }),
    ).rejects.toThrow();
    await expect(
      db.insert(rooms).values({
        id: randomUUID(),
        code: "AOV-9992",
        title: "Bad Visibility",
        thumbnail: "/mock-assets/room-1.jpg",
        hostId: suthy!.id,
        mode: "normal",
        visibility: "friends",
        status: "waiting",
        config: {
          format: "5v5",
          pickMode: "draft",
          series: "BO1",
          tools: [],
          notes: "",
        },
        searchText: "bad visibility",
      }),
    ).rejects.toThrow();
    await expect(
      db.insert(rooms).values({
        id: randomUUID(),
        code: "AOV-9993",
        title: "Bad Status",
        thumbnail: "/mock-assets/room-1.jpg",
        hostId: suthy!.id,
        mode: "normal",
        visibility: "public",
        status: "paused",
        config: {
          format: "5v5",
          pickMode: "draft",
          series: "BO1",
          tools: [],
          notes: "",
        },
        searchText: "bad status",
      }),
    ).rejects.toThrow();

    // tournament_teams.status
    await expect(
      db.insert(tournamentTeams).values({
        id: randomUUID(),
        tournamentId: nguKiet!.id,
        name: "Invalid Status Team",
        logo: "/mock-assets/team-xanh.png",
        captainId: vanhh!.id,
        status: "banned",
      }),
    ).rejects.toThrow();

    // bracket_matches.next_slot
    await expect(
      db.insert(bracketMatches).values({
        id: randomUUID(),
        tournamentId: nguKiet!.id,
        round: 1,
        position: 0,
        label: "Trận lỗi",
        nextSlot: "c",
      }),
    ).rejects.toThrow();

    // tournaments.status & tournaments.series
    const now = new Date();
    await expect(
      db.insert(tournaments).values({
        id: randomUUID(),
        slug: "bad-tour-status",
        name: "Bad Tour",
        description: "desc",
        intro: [],
        organizerId: suthy!.id,
        status: "draft",
        teamCount: 8,
        series: "BO3",
        cover: "/mock-assets/tour-1.jpg",
        registrationDeadline: now,
        drawDate: now,
        dateStart: now,
        dateEnd: now,
        rules: [],
        prizes: [],
        searchText: "bad tour",
      }),
    ).rejects.toThrow();
    await expect(
      db.insert(tournaments).values({
        id: randomUUID(),
        slug: "bad-tour-series",
        name: "Bad Tour Series",
        description: "desc",
        intro: [],
        organizerId: suthy!.id,
        status: "open",
        teamCount: 8,
        series: "BO7",
        cover: "/mock-assets/tour-1.jpg",
        registrationDeadline: now,
        drawDate: now,
        dateStart: now,
        dateEnd: now,
        rules: [],
        prizes: [],
        searchText: "bad tour series",
      }),
    ).rejects.toThrow();

    // activities.kind
    await expect(
      db.insert(activities).values({
        id: randomUUID(),
        kind: "system_alert",
        actorId: suthy!.id,
        text: "Bad activity",
      }),
    ).rejects.toThrow();
  });

  it("masks credentials and file paths in formatDatabaseTarget", () => {
    expect(
      formatDatabaseTarget(
        "postgres://admin:supersecret@db.internal:54329/customaov?sslmode=require",
      ),
    ).toBe("postgres (db.internal:54329)");
    expect(
      formatDatabaseTarget(
        "postgresql://user:pass@localhost/customaov",
      ),
    ).toBe("postgres (localhost)");
    expect(formatDatabaseTarget("./.data/pglite")).toBe("pglite");
    expect(formatDatabaseTarget("memory://")).toBe("pglite (memory)");
  });

  it("enforces partial unique index for active player in room_members and allows inactive", async () => {
    const db = await setupSeededMemoryDb();
    const [suthy] = await db
      .select()
      .from(users)
      .where(eq(users.username, "suthy"));
    const [otherRoom] = await db
      .select()
      .from(rooms)
      .where(eq(rooms.code, "AOV-1026"));

    // suthy is already active player in AOV-1024 → inserting as active player in AOV-1026 must fail
    await expect(
      db.insert(roomMembers).values({
        roomId: otherRoom!.id,
        userId: suthy!.id,
        role: "player",
        side: "blue",
        active: true,
      }),
    ).rejects.toThrow();

    // inserting as inactive player in AOV-1026 must succeed
    await db.insert(roomMembers).values({
      roomId: otherRoom!.id,
      userId: suthy!.id,
      role: "player",
      side: "blue",
      active: false,
    });
  });

  it("allows re-registration in another team when previous team is rejected (active=false)", async () => {
    const db = await setupSeededMemoryDb();
    const [nguKiet] = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.slug, "ngu-kiet-cup-mua-1"));
    const [suthy] = await db
      .select()
      .from(users)
      .where(eq(users.username, "suthy"));
    const [vanhh] = await db
      .select()
      .from(users)
      .where(eq(users.username, "vanhh"));

    const rejectedTeamId = randomUUID();
    await db.insert(tournamentTeams).values({
      id: rejectedTeamId,
      tournamentId: nguKiet!.id,
      name: "Đội Bị Từ Chối",
      logo: "/mock-assets/team-xanh.png",
      captainId: suthy!.id,
      status: "rejected",
      rejectReason: "Không đủ điều kiện",
    });
    await db.insert(tournamentTeamMembers).values({
      teamId: rejectedTeamId,
      userId: suthy!.id,
      tournamentId: nguKiet!.id,
      isSub: false,
      active: false,
    });

    // suthy can now register in another team in the same tournament
    const newTeamId = randomUUID();
    await db.insert(tournamentTeams).values({
      id: newTeamId,
      tournamentId: nguKiet!.id,
      name: "Đội Đăng Ký Lại",
      logo: "/mock-assets/team-do.png",
      captainId: vanhh!.id,
      status: "pending",
    });
    await db.insert(tournamentTeamMembers).values({
      teamId: newTeamId,
      userId: suthy!.id,
      tournamentId: nguKiet!.id,
      isSub: false,
      active: true,
    });

    // But a second active membership in the same tournament must fail
    const duplicateTeamId = randomUUID();
    await db.insert(tournamentTeams).values({
      id: duplicateTeamId,
      tournamentId: nguKiet!.id,
      name: "Đội Trùng",
      logo: "/mock-assets/team-do.png",
      captainId: vanhh!.id,
      status: "pending",
    });
    await expect(
      db.insert(tournamentTeamMembers).values({
        teamId: duplicateTeamId,
        userId: suthy!.id,
        tournamentId: nguKiet!.id,
        isSub: false,
        active: true,
      }),
    ).rejects.toThrow();
  });

  it("supports is_bye on bracket_matches and generates 16-byte base64url join_key for private rooms", async () => {
    const db = await setupSeededMemoryDb();
    const [nguKiet] = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.slug, "ngu-kiet-cup-mua-1"));

    const byeMatchId = randomUUID();
    await db.insert(bracketMatches).values({
      id: byeMatchId,
      tournamentId: nguKiet!.id,
      round: 1,
      position: 0,
      label: "Tứ kết 1",
      isBye: true,
    });
    const [inserted] = await db
      .select()
      .from(bracketMatches)
      .where(eq(bracketMatches.id, byeMatchId));
    expect(inserted?.isBye).toBe(true);

    const allRooms = await db.select().from(rooms);
    for (const r of allRooms) {
      if (r.visibility === "private") {
        expect(r.joinKey).toMatch(/^[A-Za-z0-9_-]{22}$/);
      } else {
        expect(r.joinKey).toBeNull();
      }
    }
  });
});
