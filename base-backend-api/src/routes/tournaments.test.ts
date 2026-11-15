import { randomUUID } from "node:crypto";
import {
  ErrorBodySchema,
  TournamentDetailSchema,
  TournamentsResponseSchema,
} from "@customaov/contracts";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import {
  tournamentTeamMembers,
  tournamentTeams,
  tournaments,
  users,
} from "../db/schema.js";
import { createLoggedInClient, createSeededTestApp, TestClient, type TestApp } from "../test/helpers.js";

const apps: TestApp[] = [];

async function setupSeeded(): Promise<{ testApp: TestApp; client: TestClient }> {
  const testApp = await createSeededTestApp();
  apps.push(testApp);
  return { testApp, client: new TestClient(testApp.app) };
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()));
});

describe("GET /api/tournaments", () => {
  it("returns all 8 seeded tournaments and parses with contracts schema", async () => {
    const { client } = await setupSeeded();

    const res = await client.request("GET", "/api/tournaments");
    expect(res.statusCode).toBe(200);

    const parsed = TournamentsResponseSchema.parse(res.json());
    expect(parsed.total).toBe(8);
    expect(parsed.items).toHaveLength(8);
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(10);

    const nguKiet = parsed.items.find((t) => t.slug === "ngu-kiet-cup-mua-1");
    expect(nguKiet).toBeDefined();
    expect(nguKiet?.registeredTeams).toBe(11);
    expect(nguKiet?.timeLabel).toBe("Hạn đăng ký: 20/11, 23:59");
    expect(nguKiet?.dateRange).toBe("22/11 – 27/11");

    const customLeague = parsed.items.find((t) => t.slug === "custom-league-3");
    expect(customLeague).toBeDefined();
    expect(customLeague?.registeredTeams).toBeUndefined();
    expect(customLeague?.timeLabel).toBe("Thời gian: 10/11 – 24/11");
    expect(customLeague?.dateRange).toBe("10/11 – 24/11");
  });

  it("filters status=open to the 3 open tournaments", async () => {
    const { client } = await setupSeeded();

    const res = await client.request("GET", "/api/tournaments?status=open");
    expect(res.statusCode).toBe(200);

    const parsed = TournamentsResponseSchema.parse(res.json());
    expect(parsed.total).toBe(3);
    expect(parsed.items.map((t) => t.slug).sort()).toEqual([
      "dai-chien-lien-server",
      "dau-truong-sinh-vien-2026",
      "ngu-kiet-cup-mua-1",
    ]);
    expect(parsed.items.every((t) => t.status === "open" && typeof t.registeredTeams === "number")).toBe(
      true,
    );
  });

  it("searches accent-insensitively via q=ngu kiet", async () => {
    const { client } = await setupSeeded();

    const res = await client.request("GET", "/api/tournaments?q=ngu%20kiet");
    expect(res.statusCode).toBe(200);

    const parsed = TournamentsResponseSchema.parse(res.json());
    expect(parsed.total).toBe(2);
    expect(parsed.items[0]?.slug).toBe("ngu-kiet-cup-mua-1");
    expect(parsed.items.map((t) => t.slug)).toEqual([
      "ngu-kiet-cup-mua-1",
      "cup-mua-thu-2026",
    ]);
  });

  it("sorts by deadline and paginates accurately", async () => {
    const { client } = await setupSeeded();

    const openByDeadline = await client.request(
      "GET",
      "/api/tournaments?status=open&sort=deadline",
    );
    expect(openByDeadline.statusCode).toBe(200);
    const openParsed = TournamentsResponseSchema.parse(openByDeadline.json());
    expect(openParsed.items.map((t) => t.slug)).toEqual([
      "ngu-kiet-cup-mua-1",
      "dau-truong-sinh-vien-2026",
      "dai-chien-lien-server",
    ]);

    const page1 = await client.request("GET", "/api/tournaments?page=1&pageSize=3");
    const page2 = await client.request("GET", "/api/tournaments?page=2&pageSize=3");
    const page3 = await client.request("GET", "/api/tournaments?page=3&pageSize=3");

    const p1 = TournamentsResponseSchema.parse(page1.json());
    const p2 = TournamentsResponseSchema.parse(page2.json());
    const p3 = TournamentsResponseSchema.parse(page3.json());

    expect(p1.total).toBe(8);
    expect(p1.items).toHaveLength(3);
    expect(p2.items).toHaveLength(3);
    expect(p3.items).toHaveLength(2);

    const allSlugs = [...p1.items, ...p2.items, ...p3.items].map((t) => t.slug);
    expect(new Set(allSlugs).size).toBe(8);
  });

  it("rejects invalid query params with 400 VALIDATION", async () => {
    const { client } = await setupSeeded();

    const res = await client.request("GET", "/api/tournaments?status=unknown");
    expect(res.statusCode).toBe(400);
    const err = ErrorBodySchema.parse(res.json());
    expect(err.error.code).toBe("VALIDATION");
  });
});

describe("GET /api/tournaments/:slug", () => {
  it("matches mock details for Ngũ Kiệt Cup, Custom League #3, Hội Làng, and Cup Mùa Thu", async () => {
    const { client } = await setupSeeded();

    const nguKietRes = await client.request("GET", "/api/tournaments/ngu-kiet-cup-mua-1");
    expect(nguKietRes.statusCode).toBe(200);
    const nguKiet = TournamentDetailSchema.parse(nguKietRes.json());
    expect(nguKiet.teamList).toHaveLength(11);
    expect(nguKiet.bracket).toEqual([]);
    expect(nguKiet.upcoming).toEqual([]);
    expect(nguKiet.results).toEqual([]);
    expect(nguKiet.champion).toBeNull();
    expect(nguKiet.myRole).toBeNull();
    expect(nguKiet.myRegistration).toBeNull();

    const customRes = await client.request("GET", "/api/tournaments/custom-league-3");
    expect(customRes.statusCode).toBe(200);
    const customLeague = TournamentDetailSchema.parse(customRes.json());
    expect(customLeague.status).toBe("live");
    expect(customLeague.bracket).toHaveLength(3);
    expect(customLeague.upcoming.length).toBeGreaterThan(0);
    expect(customLeague.upcoming[0]?.stage).toBe("Chung kết");
    expect(customLeague.results).toHaveLength(6);
    expect(customLeague.champion).toBeNull();

    const hoiLangRes = await client.request("GET", "/api/tournaments/hoi-lang-keo-vui");
    expect(hoiLangRes.statusCode).toBe(200);
    const hoiLang = TournamentDetailSchema.parse(hoiLangRes.json());
    expect(hoiLang.status).toBe("finished");
    expect(hoiLang.champion?.name).toBe("Ngũ Hổ");

    const cupMuaThuRes = await client.request("GET", "/api/tournaments/cup-mua-thu-2026");
    expect(cupMuaThuRes.statusCode).toBe(200);
    const cupMuaThu = TournamentDetailSchema.parse(cupMuaThuRes.json());
    expect(cupMuaThu.status).toBe("finished");
    expect(cupMuaThu.champion?.name).toBe("Team Alpha");
  });

  it("computes myRole accurately for organizer, guest, captain, and member", async () => {
    const { testApp, client } = await setupSeeded();

    // Guest
    const guestRes = await client.request("GET", "/api/tournaments/ngu-kiet-cup-mua-1");
    expect(TournamentDetailSchema.parse(guestRes.json()).myRole).toBeNull();

    // Login as suthy (organizer of Ngũ Kiệt Cup, non-member of Custom League #3)
    const loginRes = await client.login("suthy", "customaov123");
    expect(loginRes.statusCode).toBe(200);

    const btcRes = await client.request("GET", "/api/tournaments/ngu-kiet-cup-mua-1");
    const btcDetail = TournamentDetailSchema.parse(btcRes.json());
    expect(btcDetail.myRole).toBe("organizer");
    expect(btcDetail.myRegistration).toBeNull();

    const otherRes = await client.request("GET", "/api/tournaments/custom-league-3");
    expect(TournamentDetailSchema.parse(otherRes.json()).myRole).toBeNull();

    // Register a full 5-member team in Đấu Trường Sinh Viên 2026 (organizer is vanhh)
    const [sinhVien] = await testApp.db
      .select()
      .from(tournaments)
      .where(eq(tournaments.slug, "dau-truong-sinh-vien-2026"));
    const allUsers = await testApp.db.select().from(users);
    const suthy = allUsers.find((u) => u.username === "suthy")!;

    // Pick 4 other users not yet in dau-truong-sinh-vien-2026
    const existingMembers = await testApp.db
      .select({ userId: tournamentTeamMembers.userId })
      .from(tournamentTeamMembers)
      .where(eq(tournamentTeamMembers.tournamentId, sinhVien!.id));
    const existingIds = new Set(existingMembers.map((m) => m.userId));
    const available = allUsers.filter(
      (u) => u.id !== suthy.id && !existingIds.has(u.id),
    );
    expect(available.length).toBeGreaterThanOrEqual(4);

    const teamId = randomUUID();
    await testApp.db.insert(tournamentTeams).values({
      id: teamId,
      tournamentId: sinhVien!.id,
      name: "Suthy Squad",
      logo: "/mock-assets/team-xanh.png",
      captainId: suthy.id,
      status: "pending",
    });

    await testApp.db.insert(tournamentTeamMembers).values([
      { teamId, userId: suthy.id, tournamentId: sinhVien!.id, isSub: false, active: true },
      ...available.slice(0, 4).map((u) => ({
        teamId,
        userId: u.id,
        tournamentId: sinhVien!.id,
        isSub: false,
        active: true,
      })),
    ]);

    const captainRes = await client.request(
      "GET",
      "/api/tournaments/dau-truong-sinh-vien-2026",
    );
    const captainDetail = TournamentDetailSchema.parse(captainRes.json());
    expect(captainDetail.myRole).toBe("captain");
    expect(captainDetail.myRegistration?.teamName).toBe("Suthy Squad");
    expect(captainDetail.myRegistration?.members).toHaveLength(5);
    expect(captainDetail.myRegistration?.status).toBe("pending");

    // Login as one of the 4 teammates -> myRole: "member"
    const teammateClient = new TestClient(testApp.app);
    await teammateClient.login(available[0]!.username, "customaov123");
    const memberRes = await teammateClient.request(
      "GET",
      "/api/tournaments/dau-truong-sinh-vien-2026",
    );
    const memberDetail = TournamentDetailSchema.parse(memberRes.json());
    expect(memberDetail.myRole).toBe("member");
    expect(memberDetail.myRegistration?.id).toBe(teamId);
  });

  it("returns 404 NOT_FOUND for unknown slug", async () => {
    const { client } = await setupSeeded();

    const res = await client.request("GET", "/api/tournaments/giai-khong-ton-tai");
    expect(res.statusCode).toBe(404);
    const err = ErrorBodySchema.parse(res.json());
    expect(err.error.code).toBe("NOT_FOUND");
  });
});


const NEW_BODY = {
  name: "Cúp Đêm Hè",
  description: "Giải thử nghiệm",
  intro: ["Dòng 1"],
  teamCount: 8,
  series: "BO3",
  registrationDeadline: "2026-12-01T10:00:00.000Z",
  drawDate: "2026-12-02T10:00:00.000Z",
  dateStart: "2026-12-03T10:00:00.000Z",
  dateEnd: "2026-12-05T10:00:00.000Z",
  rules: ["Luật 1"],
  prizes: [{ place: "Hạng 1", reward: "1tr" }],
  cover: "tour-2",
};

describe("POST/PATCH /api/tournaments", () => {
  it("creates a tournament: slug, open, myRole=organizer, searchable", async () => {
    const { testApp } = await setupSeeded();
    const { client, userId } = await createLoggedInClient(testApp.app, "btc1", "BTC Một");

    const res = await client.request("POST", "/api/tournaments", { payload: NEW_BODY });
    expect(res.statusCode).toBe(201);
    const detail = TournamentDetailSchema.parse(res.json());
    expect(detail.slug).toBe("cup-dem-he");
    expect(detail.status).toBe("open");
    expect(detail.myRole).toBe("organizer");
    expect(detail.organizer).toBe("BTC Một");

    const [row] = await testApp.db.select().from(tournaments).where(eq(tournaments.slug, "cup-dem-he"));
    expect(row?.organizerId).toBe(userId);

    const search = await client.request("GET", "/api/tournaments?q=cup dem he");
    expect(TournamentsResponseSchema.parse(search.json()).items.map((t) => t.slug)).toContain("cup-dem-he");
  });

  it("adds -2/-3 suffix for duplicate names", async () => {
    const { testApp } = await setupSeeded();
    const { client } = await createLoggedInClient(testApp.app, "btc1");
    const slugs: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const res = await client.request("POST", "/api/tournaments", { payload: NEW_BODY });
      expect(res.statusCode).toBe(201);
      slugs.push((res.json() as { slug: string }).slug);
    }
    expect(slugs).toEqual(["cup-dem-he", "cup-dem-he-2", "cup-dem-he-3"]);
  });

  it("returns 401 when not logged in", async () => {
    const { client } = await setupSeeded();
    await client.fetchCsrf();
    const res = await client.request("POST", "/api/tournaments", { payload: NEW_BODY });
    expect(res.statusCode).toBe(401);
    expect(ErrorBodySchema.parse(res.json()).error.code).toBe("UNAUTHENTICATED");
  });

  it("returns 403 CSRF without a token", async () => {
    const { testApp } = await setupSeeded();
    const { client } = await createLoggedInClient(testApp.app, "btc1");
    const res = await client.request("POST", "/api/tournaments", { payload: NEW_BODY, csrf: null });
    expect(res.statusCode).toBe(403);
    expect(ErrorBodySchema.parse(res.json()).error.code).toBe("CSRF");
  });

  it("returns 400 for wrong date order", async () => {
    const { testApp } = await setupSeeded();
    const { client } = await createLoggedInClient(testApp.app, "btc1");
    const res = await client.request("POST", "/api/tournaments", {
      payload: { ...NEW_BODY, drawDate: "2026-11-01T10:00:00.000Z" },
    });
    expect(res.statusCode).toBe(400);
    const body = ErrorBodySchema.parse(res.json());
    expect(body.error.code).toBe("VALIDATION");
    expect(JSON.stringify(body.error.details)).toContain("drawDate");
  });

  it("rate limits creation at 10 per hour per user", async () => {
    const { testApp } = await setupSeeded();
    const { client } = await createLoggedInClient(testApp.app, "btc1");
    for (let i = 0; i < 10; i += 1) {
      const res = await client.request("POST", "/api/tournaments", { payload: NEW_BODY });
      expect(res.statusCode).toBe(201);
    }
    const res = await client.request("POST", "/api/tournaments", { payload: NEW_BODY });
    expect(res.statusCode).toBe(429);
  });

  describe("PATCH", () => {
    it("lets the organizer update; others get 403; live gets 409; merged date order checked", async () => {
      const { testApp } = await setupSeeded();
      const { client } = await createLoggedInClient(testApp.app, "btc1");
      const { client: other } = await createLoggedInClient(testApp.app, "other1");
      await client.request("POST", "/api/tournaments", { payload: NEW_BODY });

      const ok = await client.request("PATCH", "/api/tournaments/cup-dem-he", {
        payload: { description: "Mô tả mới", teamCount: 16 },
      });
      expect(ok.statusCode).toBe(200);
      const updated = TournamentDetailSchema.parse(ok.json());
      expect(updated.description).toBe("Mô tả mới");
      expect(updated.teamCount).toBe(16);
      expect(updated.slug).toBe("cup-dem-he");

      const forbidden = await other.request("PATCH", "/api/tournaments/cup-dem-he", {
        payload: { description: "Hack" },
      });
      expect(forbidden.statusCode).toBe(403);

      // Only drawDate sent: valid alone, but invalid after merging with stored dates.
      const badMerge = await client.request("PATCH", "/api/tournaments/cup-dem-he", {
        payload: { drawDate: "2026-11-01T10:00:00.000Z" },
      });
      expect(badMerge.statusCode).toBe(400);
      expect(JSON.stringify(ErrorBodySchema.parse(badMerge.json()).error.details)).toContain("drawDate");

      const missing = await client.request("PATCH", "/api/tournaments/khong-co", {
        payload: { description: "x" },
      });
      expect(missing.statusCode).toBe(404);

      await testApp.db
        .update(tournaments)
        .set({ status: "live" })
        .where(eq(tournaments.slug, "cup-dem-he"));
      const conflict = await client.request("PATCH", "/api/tournaments/cup-dem-he", {
        payload: { description: "Muộn rồi" },
      });
      expect(conflict.statusCode).toBe(409);
      expect(ErrorBodySchema.parse(conflict.json()).error.code).toBe("CONFLICT");
    });
  });
});
