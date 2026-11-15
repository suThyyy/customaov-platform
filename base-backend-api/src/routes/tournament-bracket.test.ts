import { randomUUID } from "node:crypto";
import {
  ErrorBodySchema,
  TournamentDetailSchema,
  type TournamentDetail,
} from "@customaov/contracts";
import { and, asc, eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import {
  activities,
  activityRecipients,
  bracketMatches,
  tournamentTeams,
  tournaments,
  users,
} from "../db/schema.js";
import {
  createLoggedInClient,
  createSeededTestApp,
  TestClient,
  type TestApp,
} from "../test/helpers.js";

const NOW = new Date("2026-11-15T12:00:00.000Z");
const apps: TestApp[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()));
});

async function setup(): Promise<{
  testApp: TestApp;
  organizer: TestClient;
  organizerId: string;
}> {
  const testApp = await createSeededTestApp({ now: () => NOW });
  apps.push(testApp);
  const organizer = new TestClient(testApp.app);
  const login = await organizer.login("suthy", "customaov123");
  expect(login.statusCode).toBe(200);
  const [row] = await testApp.db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, "suthy"));
  return { testApp, organizer, organizerId: row!.id };
}

/** Giải `open` mới do `organizerId` tổ chức, có `teams` đội đã duyệt. */
async function insertTournament(
  testApp: TestApp,
  organizerId: string,
  teams: number,
  opts: { series?: "BO1" | "BO3" | "BO5"; pending?: number } = {},
): Promise<string> {
  const slug = `test-cup-${randomUUID().slice(0, 8)}`;
  const id = randomUUID();
  await testApp.db.insert(tournaments).values({
    id,
    slug,
    name: `Test Cup ${slug}`,
    titleAccent: null,
    description: "Giải thử nghiệm",
    intro: ["Giải thử nghiệm"],
    organizerId,
    status: "open",
    teamCount: teams <= 4 ? 4 : teams <= 8 ? 8 : 16,
    series: opts.series ?? "BO3",
    cover: "tour-1",
    registrationDeadline: new Date("2026-11-20T16:59:00.000Z"),
    drawDate: new Date("2026-11-21T12:00:00.000Z"),
    dateStart: new Date("2026-11-22T12:00:00.000Z"),
    dateEnd: new Date("2026-11-27T15:00:00.000Z"),
    rules: [],
    prizes: [],
    searchText: slug,
  });
  const rows = Array.from({ length: teams + (opts.pending ?? 0) }, (_, i) => ({
    tournamentId: id,
    name: `Đội ${i + 1}`,
    logo: "/mock-assets/team-1.png",
    captainId: organizerId,
    status: i < teams ? "approved" : "pending",
    seed: i + 1,
  }));
  if (rows.length > 0) await testApp.db.insert(tournamentTeams).values(rows);
  return slug;
}

async function tournamentRow(testApp: TestApp, slug: string) {
  const [row] = await testApp.db
    .select()
    .from(tournaments)
    .where(eq(tournaments.slug, slug));
  return row!;
}

async function matchRows(testApp: TestApp, slug: string) {
  const t = await tournamentRow(testApp, slug);
  return testApp.db
    .select()
    .from(bracketMatches)
    .where(eq(bracketMatches.tournamentId, t.id))
    .orderBy(asc(bracketMatches.round), asc(bracketMatches.position));
}

function byeSlots(detail: TournamentDetail): number {
  return detail.bracket.flatMap((r) => r.matches.flatMap((m) => m.slots)).filter((s) => s.bye)
    .length;
}

async function draw(client: TestClient, slug: string): Promise<TournamentDetail> {
  const res = await client.request("POST", `/api/tournaments/${slug}/draw`);
  expect(res.statusCode, res.body).toBe(200);
  return TournamentDetailSchema.parse(res.json());
}

async function score(
  client: TestClient,
  slug: string,
  matchId: string,
  scoreA: number,
  scoreB: number,
) {
  return client.request("POST", `/api/tournaments/${slug}/matches/${matchId}/score`, {
    payload: { scoreA, scoreB },
  });
}

function expectError(res: { statusCode: number; json(): unknown }, status: number, code: string) {
  expect(res.statusCode).toBe(status);
  expect(ErrorBodySchema.parse(res.json()).error.code).toBe(code);
}

describe("POST /api/tournaments/:slug/draw", () => {
  it.each([
    { teams: 3, byes: 1, rounds: 2, upcoming: 1 },
    { teams: 5, byes: 3, rounds: 3, upcoming: 2 },
    { teams: 8, byes: 0, rounds: 3, upcoming: 4 },
  ])("draws $teams teams with $byes byes and moves the tournament to live", async (c) => {
    const { testApp, organizer, organizerId } = await setup();
    const slug = await insertTournament(testApp, organizerId, c.teams, { pending: 1 });

    const detail = await draw(organizer, slug);
    expect(detail.status).toBe("live");
    expect(detail.bracket).toHaveLength(c.rounds);
    expect(byeSlots(detail)).toBe(c.byes);
    expect(detail.upcoming).toHaveLength(c.upcoming);
    expect(detail.results).toHaveLength(0);
    expect(detail.myRole).toBe("organizer");

    const rows = await matchRows(testApp, slug);
    expect(rows).toHaveLength(2 ** c.rounds - 1);
    const byeRows = rows.filter((r) => r.isBye);
    expect(byeRows).toHaveLength(c.byes);
    for (const bye of byeRows) {
      expect(bye.round).toBe(1);
      expect(bye.teamBId).toBeNull();
      expect(bye.winnerTeamId).toBe(bye.teamAId);
      const next = rows.find((r) => r.id === bye.nextMatchId)!;
      expect(bye.nextSlot === "a" ? next.teamAId : next.teamBId).toBe(bye.teamAId);
    }
    const final = rows.find((r) => r.nextMatchId === null)!;
    expect(final.round).toBe(c.rounds);
    expect(final.label).toBe("Chung kết");

    // Đội pending không được bốc vào nhánh.
    const placed = new Set(rows.flatMap((r) => [r.teamAId, r.teamBId]).filter(Boolean));
    expect(placed.size).toBe(c.teams);

    const get = await new TestClient(testApp.app).request("GET", `/api/tournaments/${slug}`);
    expect(get.statusCode).toBe(200);
    const publicDetail = TournamentDetailSchema.parse(get.json());
    expect(publicDetail.status).toBe("live");
    expect(publicDetail.bracket).toHaveLength(c.rounds);
    expect(byeSlots(publicDetail)).toBe(c.byes);
  });

  it("draws the seeded Ngũ Kiệt Cup (11 approved) into a 16 bracket with 5 byes", async () => {
    const { testApp, organizer } = await setup();
    const detail = await draw(organizer, "ngu-kiet-cup-mua-1");
    expect(detail.status).toBe("live");
    expect(detail.teamList).toHaveLength(11);
    expect(detail.bracket).toHaveLength(4);
    expect(detail.bracket[0]!.matches).toHaveLength(8);
    expect(byeSlots(detail)).toBe(5);
    // 3 trận vòng 1 đủ đội + 2 trận vòng 2 có hai đội được bye.
    expect(detail.upcoming).toHaveLength(5);
    const rows = await matchRows(testApp, "ngu-kiet-cup-mua-1");
    expect(rows).toHaveLength(15);
    expect(rows.filter((r) => r.isBye)).toHaveLength(5);
  });

  it("allows redraw before any score and rejects it after a score (409)", async () => {
    const { testApp, organizer, organizerId } = await setup();
    const slug = await insertTournament(testApp, organizerId, 4);

    const first = await draw(organizer, slug);
    const firstIds = (await matchRows(testApp, slug)).map((r) => r.id).sort();

    const second = await draw(organizer, slug);
    expect(second.status).toBe("live");
    const secondRows = await matchRows(testApp, slug);
    expect(secondRows).toHaveLength(3);
    expect(secondRows.map((r) => r.id).sort()).not.toEqual(firstIds);
    expect(first.upcoming).toHaveLength(2);

    const res = await score(organizer, slug, second.upcoming[0]!.id, 2, 1);
    expect(res.statusCode).toBe(200);

    expectError(await organizer.request("POST", `/api/tournaments/${slug}/draw`), 409, "CONFLICT");
    expect((await matchRows(testApp, slug)).map((r) => r.id).sort()).toEqual(
      secondRows.map((r) => r.id).sort(),
    );
  });

  it("requires at least 2 approved teams (409)", async () => {
    const { testApp, organizer, organizerId } = await setup();
    const slug = await insertTournament(testApp, organizerId, 1, { pending: 3 });
    expectError(await organizer.request("POST", `/api/tournaments/${slug}/draw`), 409, "CONFLICT");
    expect((await tournamentRow(testApp, slug)).status).toBe("open");
  });

  it("rejects drawing a finished tournament (409) and unknown slug (404)", async () => {
    const { organizer } = await setup();
    expectError(
      await organizer.request("POST", "/api/tournaments/cup-mua-thu-2026/draw"),
      409,
      "CONFLICT",
    );
    expectError(
      await organizer.request("POST", "/api/tournaments/khong-co-giai/draw"),
      404,
      "NOT_FOUND",
    );
  });
});

describe("POST /api/tournaments/:slug/matches/:matchId/score", () => {
  it("plays the bracket to the final: finished + champion + result activity", async () => {
    const { testApp, organizer, organizerId } = await setup();
    const slug = await insertTournament(testApp, organizerId, 5);
    let detail = await draw(organizer, slug);

    let lastWinner: string | null = null;
    for (let guard = 0; guard < 10 && detail.upcoming.length > 0; guard += 1) {
      const match = detail.upcoming[0]!;
      const res = await score(organizer, slug, match.id, 1, 2);
      expect(res.statusCode, res.body).toBe(200);
      detail = TournamentDetailSchema.parse(res.json());
      lastWinner = match.away.id;
    }

    expect(detail.status).toBe("finished");
    expect(detail.champion?.id).toBe(lastWinner);
    expect(detail.results).toHaveLength(4);
    const t = await tournamentRow(testApp, slug);
    expect(t.status).toBe("finished");
    expect(t.championTeamId).toBe(lastWinner);

    const acts = await testApp.db
      .select()
      .from(activities)
      .where(and(eq(activities.tournamentId, t.id), eq(activities.kind, "result")));
    expect(acts).toHaveLength(1);
    expect(acts[0]!.emphasis).toContain("vô địch");
    const recipients = await testApp.db
      .select()
      .from(activityRecipients)
      .where(eq(activityRecipients.activityId, acts[0]!.id));
    expect(recipients.map((r) => r.userId)).toContain(organizerId);

    // Thắng chung kết lần nữa với cùng đội: không sinh thêm hoạt động.
    const final = (await matchRows(testApp, slug)).find((r) => r.nextMatchId === null)!;
    expect((await score(organizer, slug, final.id, 0, 2)).statusCode).toBe(200);
    const actsAfter = await testApp.db
      .select()
      .from(activities)
      .where(eq(activities.tournamentId, t.id));
    expect(actsAfter).toHaveLength(1);
  });

  it("maps engine errors: invalid score 400, TBD match 409, locked match 409", async () => {
    const { testApp, organizer, organizerId } = await setup();
    const slug = await insertTournament(testApp, organizerId, 4);
    const detail = await draw(organizer, slug);
    const [m1, m2] = detail.upcoming;
    const final = (await matchRows(testApp, slug)).find((r) => r.nextMatchId === null)!;

    expectError(await score(organizer, slug, m1!.id, 3, 0), 400, "VALIDATION");
    expectError(await score(organizer, slug, m1!.id, 1, 1), 400, "VALIDATION");
    expectError(await score(organizer, slug, final.id, 2, 0), 409, "CONFLICT");

    expect((await score(organizer, slug, m1!.id, 2, 0)).statusCode).toBe(200);
    // Sửa tỉ số khi vòng sau chưa có tỉ số: được phép.
    expect((await score(organizer, slug, m1!.id, 2, 1)).statusCode).toBe(200);
    expect((await score(organizer, slug, m2!.id, 0, 2)).statusCode).toBe(200);
    expect((await score(organizer, slug, final.id, 2, 1)).statusCode).toBe(200);
    expectError(await score(organizer, slug, m1!.id, 0, 2), 409, "CONFLICT");

    const bye = await insertTournament(testApp, organizerId, 3);
    await draw(organizer, bye);
    const byeRow = (await matchRows(testApp, bye)).find((r) => r.isBye)!;
    expectError(await score(organizer, bye, byeRow.id, 2, 0), 409, "CONFLICT");
  });

  it("validates body and match id (400) and unknown match (404)", async () => {
    const { testApp, organizer, organizerId } = await setup();
    const slug = await insertTournament(testApp, organizerId, 2);
    const detail = await draw(organizer, slug);
    const matchId = detail.upcoming[0]!.id;

    expectError(
      await organizer.request("POST", `/api/tournaments/${slug}/matches/${matchId}/score`, {
        payload: { scoreA: -1, scoreB: 2 },
      }),
      400,
      "VALIDATION",
    );
    expectError(await score(organizer, slug, "not-a-uuid", 2, 0), 400, "VALIDATION");
    expectError(await score(organizer, slug, randomUUID(), 2, 0), 404, "NOT_FOUND");

    // Giải chưa bốc thăm → 409; trận thuộc giải khác → 404.
    const other = await insertTournament(testApp, organizerId, 2);
    expectError(await score(organizer, other, matchId, 2, 0), 409, "CONFLICT");
    await draw(organizer, other);
    expectError(await score(organizer, other, matchId, 2, 0), 404, "NOT_FOUND");
  });
});

describe("PATCH /api/tournaments/:slug/matches/:matchId", () => {
  it("sets scheduledAt and shows the time in upcoming", async () => {
    const { testApp, organizer, organizerId } = await setup();
    const slug = await insertTournament(testApp, organizerId, 3);
    const detail = await draw(organizer, slug);
    const match = detail.upcoming[0]!;
    expect(match.time).toBe("Chưa xếp lịch");

    const res = await organizer.request("PATCH", `/api/tournaments/${slug}/matches/${match.id}`, {
      payload: { scheduledAt: "2026-11-22T19:00:00+07:00" },
    });
    expect(res.statusCode, res.body).toBe(200);
    const updated = TournamentDetailSchema.parse(res.json());
    expect(updated.upcoming.find((m) => m.id === match.id)?.time).toBe("22/11 19:00");

    expectError(
      await organizer.request("PATCH", `/api/tournaments/${slug}/matches/${match.id}`, {
        payload: { scheduledAt: "ngày mai" },
      }),
      400,
      "VALIDATION",
    );
    const byeRow = (await matchRows(testApp, slug)).find((r) => r.isBye)!;
    expectError(
      await organizer.request("PATCH", `/api/tournaments/${slug}/matches/${byeRow.id}`, {
        payload: { scheduledAt: "2026-11-22T19:00:00+07:00" },
      }),
      409,
      "CONFLICT",
    );
    expectError(
      await organizer.request("PATCH", `/api/tournaments/${slug}/matches/${randomUUID()}`, {
        payload: { scheduledAt: "2026-11-22T19:00:00+07:00" },
      }),
      404,
      "NOT_FOUND",
    );
  });
});

describe("POST /api/tournaments/:slug/close-registration", () => {
  it("closes an open tournament by pulling the deadline to now; repeats and non-open → 409", async () => {
    const { testApp, organizer, organizerId } = await setup();
    const slug = await insertTournament(testApp, organizerId, 4);

    const res = await organizer.request("POST", `/api/tournaments/${slug}/close-registration`);
    expect(res.statusCode, res.body).toBe(200);
    const detail = TournamentDetailSchema.parse(res.json());
    expect(detail.status).toBe("open");
    expect(detail.registrationDeadline).toBe(NOW.toISOString());
    expect((await tournamentRow(testApp, slug)).registrationDeadline.toISOString()).toBe(
      NOW.toISOString(),
    );

    expectError(
      await organizer.request("POST", `/api/tournaments/${slug}/close-registration`),
      409,
      "CONFLICT",
    );

    await draw(organizer, slug);
    expectError(
      await organizer.request("POST", `/api/tournaments/${slug}/close-registration`),
      409,
      "CONFLICT",
    );
  });
});

describe("authorization and CSRF", () => {
  it("rejects non-organizers (403), guests (401) and missing CSRF (403 CSRF)", async () => {
    const { testApp, organizer, organizerId } = await setup();
    const slug = await insertTournament(testApp, organizerId, 4);
    const detail = await draw(organizer, slug);
    const matchId = detail.upcoming[0]!.id;

    const { client: stranger } = await createLoggedInClient(testApp.app, "nguoila");
    const guest = new TestClient(testApp.app);
    await guest.fetchCsrf();

    const calls: Array<["POST" | "PATCH", string, unknown]> = [
      ["POST", `/api/tournaments/${slug}/close-registration`, undefined],
      ["POST", `/api/tournaments/${slug}/draw`, undefined],
      ["POST", `/api/tournaments/${slug}/matches/${matchId}/score`, { scoreA: 2, scoreB: 0 }],
      [
        "PATCH",
        `/api/tournaments/${slug}/matches/${matchId}`,
        { scheduledAt: "2026-11-22T19:00:00+07:00" },
      ],
    ];

    for (const [method, url, payload] of calls) {
      expectError(await stranger.request(method, url, { payload }), 403, "FORBIDDEN");
      expectError(await guest.request(method, url, { payload }), 401, "UNAUTHENTICATED");
      expectError(await organizer.request(method, url, { payload, csrf: null }), 403, "CSRF");
    }

    // Không có gì thay đổi.
    const rows = await matchRows(testApp, slug);
    expect(rows.every((r) => r.scoreA === null && r.scheduledAt === null)).toBe(true);
  });
});
