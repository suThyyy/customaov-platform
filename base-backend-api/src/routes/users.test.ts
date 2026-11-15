import { randomUUID } from "node:crypto";
import {
  ErrorBodySchema,
  UpdateMeResponseSchema,
  UserProfileSchema,
} from "@customaov/contracts";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import {
  roomMatches,
  rooms,
  tournaments,
  tournamentTeamMembers,
  tournamentTeams,
  users,
} from "../db/schema.js";
import { seedDatabase } from "../db/seed.js";
import { createTestApp, TestClient, type TestApp } from "../test/helpers.js";

let current: TestApp | undefined;
afterEach(async () => {
  await current?.close();
  current = undefined;
});

async function setup() {
  current = await createTestApp();
  return { t: current, c: new TestClient(current.app) };
}

function assertNoPasswordLeak(payload: unknown): void {
  const serialized = JSON.stringify(payload);
  expect(serialized).not.toContain("password");
  expect(serialized).not.toContain("passwordHash");
  expect(serialized).not.toContain("password_hash");
}

describe("GET /api/users/:username", () => {
  it("allows guests to view seeded suthy profile matching seed data", async () => {
    const { t, c } = await setup();
    await seedDatabase(t.db, { nodeEnv: "test" });

    const res = await c.request("GET", "/api/users/suthy");
    expect(res.statusCode).toBe(200);

    const raw = res.json();
    assertNoPasswordLeak(raw);
    const profile = UserProfileSchema.parse(raw);

    expect(profile.user.username).toBe("suthy");
    expect(profile.user.displayName).toBe("suthy");
    expect(profile.user.avatarUrl).toBe("/mock-assets/av-suthy.png");
    expect(profile.user.level).toBe(42);
    expect(profile.user.crowned).toBe(true);
    expect(profile.uid).toBe("102394");
    expect(profile.bio).toBe("Custom vui là chính");
    expect(profile.bioExtra).toBe("Đang theo dõi giải Custom League #3");
    expect(profile.roleBadge).toBe("Chủ phòng (Host)");
    expect(profile.playerBadge).toBe("Người chơi Custom");
    expect(profile.stats).toEqual({
      customMatches: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      tournamentsJoined: 0,
      titles: 0,
    });
    expect(profile.achievements).toEqual([]);
    expect(profile.history).toEqual([]);
  });

  it("computes custom match stats, 20-match history limit, tournament stats, and derived achievements", async () => {
    const { t, c } = await setup();
    await seedDatabase(t.db, { nodeEnv: "test" });

    const [suthy] = await t.db
      .select()
      .from(users)
      .where(eq(users.username, "suthy"));
    const [vanhh] = await t.db
      .select()
      .from(users)
      .where(eq(users.username, "vanhh"));
    const [room] = await t.db
      .select()
      .from(rooms)
      .where(eq(rooms.code, "AOV-1024"));
    const [hoiLang] = await t.db
      .select()
      .from(tournaments)
      .where(eq(tournaments.slug, "hoi-lang-keo-vui"));
    const [customLeague] = await t.db
      .select()
      .from(tournaments)
      .where(eq(tournaments.slug, "custom-league-3"));

    expect(suthy && vanhh && room && hoiLang && customLeague).toBeTruthy();

    // 52 custom matches: 30 wins (blue wins when suthy in blue), 22 losses (red wins when suthy in blue)
    const baseTime = Date.parse("2026-10-01T10:00:00Z");
    const matchValues = Array.from({ length: 52 }, (_, idx) => {
      const won = idx < 30;
      const inBlue = idx % 2 === 0;
      const winner = inBlue ? (won ? "blue" : "red") : won ? "red" : "blue";
      return {
        id: randomUUID(),
        roomId: room!.id,
        winner,
        blueUserIds: inBlue ? [suthy!.id] : [vanhh!.id],
        redUserIds: inBlue ? [vanhh!.id] : [suthy!.id],
        createdAt: new Date(baseTime + idx * 60_000),
      };
    });
    await t.db.insert(roomMatches).values(matchValues);

    // Join suthy to Hội Làng champion team (approved + active) and Custom League #3 (approved + active)
    if (hoiLang!.championTeamId) {
      await t.db.insert(tournamentTeamMembers).values({
        teamId: hoiLang!.championTeamId,
        userId: suthy!.id,
        tournamentId: hoiLang!.id,
        isSub: false,
        active: true,
      });
    }

    const [clTeam] = await t.db
      .select()
      .from(tournamentTeams)
      .where(eq(tournamentTeams.tournamentId, customLeague!.id))
      .limit(1);
    if (clTeam) {
      await t.db.insert(tournamentTeamMembers).values({
        teamId: clTeam.id,
        userId: suthy!.id,
        tournamentId: customLeague!.id,
        isSub: false,
        active: true,
      });
    }

    // Add a rejected team membership to ensure it is NOT counted
    const [nguKiet] = await t.db
      .select()
      .from(tournaments)
      .where(eq(tournaments.slug, "ngu-kiet-cup-mua-1"));
    if (nguKiet) {
      const rejectedTeamId = randomUUID();
      await t.db.insert(tournamentTeams).values({
        id: rejectedTeamId,
        tournamentId: nguKiet.id,
        name: "Đội Bị Loại",
        logo: "/mock-assets/team-xanh.png",
        captainId: suthy!.id,
        status: "rejected",
      });
      await t.db.insert(tournamentTeamMembers).values({
        teamId: rejectedTeamId,
        userId: suthy!.id,
        tournamentId: nguKiet.id,
        isSub: false,
        active: false,
      });
    }

    const res = await c.request("GET", "/api/users/suthy");
    expect(res.statusCode).toBe(200);
    const profile = UserProfileSchema.parse(res.json());

    expect(profile.stats).toEqual({
      customMatches: 52,
      wins: 30,
      losses: 22,
      winRate: 58, // Math.round(30 / 52 * 100) = 58
      tournamentsJoined: 2,
      titles: 1,
    });

    // History capped at 20 most recent matches, ordered newest first
    expect(profile.history).toHaveLength(20);
    expect(profile.history[0]!.roomCode).toBe("AOV-1024");
    expect(
      new Date(profile.history[0]!.at).getTime(),
    ).toBeGreaterThan(new Date(profile.history[1]!.at).getTime());

    // Derived achievements: 1 champion (trophy), 2 joined (users), 10 matches (swords), 50 matches (star)
    const icons = profile.achievements.map((a) => a.icon);
    expect(icons).toContain("trophy");
    expect(icons).toContain("users");
    expect(icons).toContain("swords");
    expect(icons).toContain("star");
    expect(profile.achievements).toHaveLength(5);
  });

  it("returns 404 NOT_FOUND for unknown username", async () => {
    const { c } = await setup();
    const res = await c.request("GET", "/api/users/nobody_here");
    expect(res.statusCode).toBe(404);
    expect(ErrorBodySchema.parse(res.json()).error.code).toBe("NOT_FOUND");
  });
});

describe("PATCH /api/users/me", () => {
  it("updates profile fields, updates search_text, and returns Me without password fields", async () => {
    const { t, c } = await setup();
    await c.register("suthy_test", "correct-horse-battery", "Tên Cũ");

    const res = await c.request("PATCH", "/api/users/me", {
      payload: {
        displayName: "  Đội Trưởng Mới  ",
        bio: "Chơi custom mỗi tối",
        bioExtra: "Tìm kèo 5v5",
        avatarUrl: "https://cdn.example.com/avatar.png",
      },
    });
    expect(res.statusCode).toBe(200);

    const raw = res.json();
    assertNoPasswordLeak(raw);
    const body = UpdateMeResponseSchema.parse(raw);
    expect(body.user.displayName).toBe("Đội Trưởng Mới");
    expect(body.user.avatarUrl).toBe("https://cdn.example.com/avatar.png");

    const [dbUser] = await t.db
      .select()
      .from(users)
      .where(eq(users.username, "suthy_test"));
    expect(dbUser?.searchText).toContain("doi truong moi");

    // Verify GET /api/users/:username reflects updated values
    const profileRes = await c.request("GET", "/api/users/suthy_test");
    expect(profileRes.statusCode).toBe(200);
    const profile = UserProfileSchema.parse(profileRes.json());
    expect(profile.user.displayName).toBe("Đội Trưởng Mới");
    expect(profile.bio).toBe("Chơi custom mỗi tối");
    expect(profile.bioExtra).toBe("Tìm kèo 5v5");
    expect(profile.user.avatarUrl).toBe("https://cdn.example.com/avatar.png");

    // Clearing avatarUrl with null works
    const clearRes = await c.request("PATCH", "/api/users/me", {
      payload: { avatarUrl: null },
    });
    expect(clearRes.statusCode).toBe(200);
    expect(UpdateMeResponseSchema.parse(clearRes.json()).user.avatarUrl).toBeNull();
  });

  it("returns 401 UNAUTHENTICATED when not logged in", async () => {
    const { c } = await setup();
    await c.fetchCsrf();

    const res = await c.request("PATCH", "/api/users/me", {
      payload: { displayName: "Khách" },
    });
    expect(res.statusCode).toBe(401);
    expect(ErrorBodySchema.parse(res.json()).error.code).toBe("UNAUTHENTICATED");
  });

  it("returns 403 CSRF when CSRF token is missing or invalid", async () => {
    const { c } = await setup();
    await c.register("csrf_user", "correct-horse-battery", "CSRF User");

    const missing = await c.request("PATCH", "/api/users/me", {
      csrf: null,
      payload: { displayName: "Mới" },
    });
    expect(missing.statusCode).toBe(403);
    expect(ErrorBodySchema.parse(missing.json()).error.code).toBe("CSRF");

    const wrong = await c.request("PATCH", "/api/users/me", {
      csrf: "invalid.token",
      payload: { displayName: "Mới" },
    });
    expect(wrong.statusCode).toBe(403);
    expect(ErrorBodySchema.parse(wrong.json()).error.code).toBe("CSRF");
  });

  it("returns 400 VALIDATION for http avatarUrl, 281-char bio, empty displayName, or empty payload", async () => {
    const { c } = await setup();
    await c.register("val_user", "correct-horse-battery", "Val User");

    const badHttp = await c.request("PATCH", "/api/users/me", {
      payload: { avatarUrl: "http://example.com/a.png" },
    });
    expect(badHttp.statusCode).toBe(400);
    expect(ErrorBodySchema.parse(badHttp.json()).error.code).toBe("VALIDATION");

    const longBio = await c.request("PATCH", "/api/users/me", {
      payload: { bio: "a".repeat(281) },
    });
    expect(longBio.statusCode).toBe(400);
    expect(ErrorBodySchema.parse(longBio.json()).error.code).toBe("VALIDATION");

    const emptyName = await c.request("PATCH", "/api/users/me", {
      payload: { displayName: "   " },
    });
    expect(emptyName.statusCode).toBe(400);
    expect(ErrorBodySchema.parse(emptyName.json()).error.code).toBe("VALIDATION");

    const emptyBody = await c.request("PATCH", "/api/users/me", {
      payload: {},
    });
    expect(emptyBody.statusCode).toBe(400);
    expect(ErrorBodySchema.parse(emptyBody.json()).error.code).toBe("VALIDATION");
  });

  it("returns 400 VALIDATION for invalid :username param", async () => {
    const { c } = await setup();
    for (const invalid of ["ab", "InvalidUser", "bad-name!", "a".repeat(21)]) {
      const res = await c.request("GET", `/api/users/${encodeURIComponent(invalid)}`);
      expect(res.statusCode).toBe(400);
      expect(ErrorBodySchema.parse(res.json()).error.code).toBe("VALIDATION");
    }
  });
});
