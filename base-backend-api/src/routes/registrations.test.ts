import { randomUUID } from "node:crypto";
import {
  ErrorBodySchema,
  RegistrationResponseSchema,
  RegistrationsResponseSchema,
  TournamentDetailSchema,
} from "@customaov/contracts";
import { and, eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import {
  activities,
  activityRecipients,
  tournamentTeamMembers,
  tournamentTeams,
  tournaments,
  users,
} from "../db/schema.js";
import type { DbClient } from "../db/client.js";
import {
  createLoggedInClient,
  createTestApp,
  TestClient,
  type TestApp,
} from "../test/helpers.js";

const DAY = 24 * 60 * 60 * 1000;
const apps: TestApp[] = [];
let uidCounter = 200000;
let ipCounter = 1;

afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()));
});

/** Người chơi không cần đăng nhập: chèn thẳng vào DB cho nhanh (bỏ qua scrypt). */
async function insertUsers(db: DbClient, prefix: string, count: number): Promise<string[]> {
  const usernames: string[] = [];
  for (let i = 0; i < count; i++) {
    const username = `${prefix}_${i + 1}`;
    usernames.push(username);
    await db.insert(users).values({
      uid: String(uidCounter++),
      username,
      displayName: `${prefix.toUpperCase()} ${i + 1}`,
      passwordHash: "scrypt$unused",
      searchText: username,
    });
  }
  return usernames;
}

async function userId(db: DbClient, username: string): Promise<string> {
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.username, username));
  return row!.id;
}

async function insertTournament(
  db: DbClient,
  organizerId: string,
  overrides: Partial<typeof tournaments.$inferInsert> = {},
): Promise<typeof tournaments.$inferSelect> {
  const now = Date.now();
  const [row] = await db
    .insert(tournaments)
    .values({
      slug: `giai-test-${randomUUID().slice(0, 8)}`,
      name: "Giải Test",
      description: "Giải để kiểm thử đăng ký",
      intro: [],
      organizerId,
      status: "open",
      teamCount: 4,
      series: "BO3",
      cover: "tour-1",
      registrationDeadline: new Date(now + 5 * DAY),
      drawDate: new Date(now + 6 * DAY),
      dateStart: new Date(now + 7 * DAY),
      dateEnd: new Date(now + 9 * DAY),
      rules: [],
      prizes: [],
      searchText: "giai test",
      ...overrides,
    })
    .returning();
  return row!;
}

async function insertPendingTeam(
  db: DbClient,
  tournamentId: string,
  name: string,
  memberUsernames: string[],
): Promise<string> {
  const ids = await Promise.all(memberUsernames.map((u) => userId(db, u)));
  const [team] = await db
    .insert(tournamentTeams)
    .values({ tournamentId, name, logo: "/mock-assets/logo.png", captainId: ids[0]!, status: "pending" })
    .returning();
  await db.insert(tournamentTeamMembers).values(
    ids.map((id) => ({ teamId: team!.id, userId: id, tournamentId, isSub: false })),
  );
  return team!.id;
}

async function login(app: TestApp, username: string) {
  return createLoggedInClient(app.app, username, username, {
    remoteAddress: `10.9.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`,
  });
}

interface Setup {
  testApp: TestApp;
  organizer: TestClient;
  organizerId: string;
  captain: TestClient;
  captainId: string;
  /** 4 đồng đội của đội trưởng `cap_a` */
  mates: string[];
  tournament: typeof tournaments.$inferSelect;
  url: string;
}

async function setup(overrides: Partial<typeof tournaments.$inferInsert> = {}): Promise<Setup> {
  const testApp = await createTestApp();
  apps.push(testApp);
  const { client: organizer, userId: organizerId } = await login(testApp, "btc_owner");
  const { client: captain, userId: captainId } = await login(testApp, "cap_a");
  const mates = await insertUsers(testApp.db, "mate", 6);
  const tournament = await insertTournament(testApp.db, organizerId, overrides);
  return {
    testApp,
    organizer,
    organizerId,
    captain,
    captainId,
    mates,
    tournament,
    url: `/api/tournaments/${tournament.slug}/registrations`,
  };
}

const teamBody = (members: string[], subs: string[] = [], teamName = "Rồng Lửa") => ({
  teamName,
  members,
  ...(subs.length ? { subs } : {}),
});

describe("POST /api/tournaments/:slug/registrations", () => {
  it("tạo đơn pending (201), khớp contracts, sinh activity cho đội trưởng và BTC", async () => {
    const s = await setup();
    const res = await s.captain.request("POST", s.url, {
      payload: teamBody(["cap_a", ...s.mates.slice(0, 4)], s.mates.slice(4, 6)),
    });
    expect(res.statusCode).toBe(201);
    const reg = RegistrationResponseSchema.parse(res.json());
    expect(reg.status).toBe("pending");
    expect(reg.teamName).toBe("Rồng Lửa");
    expect(reg.members[0]!.username).toBe("cap_a");
    expect(reg.subs.map((u) => u.username)).toEqual(["mate_5", "mate_6"]);
    expect(reg.rejectReason).toBeNull();

    const recipients = await s.testApp.db
      .select({ userId: activityRecipients.userId, kind: activities.kind })
      .from(activityRecipients)
      .innerJoin(activities, eq(activityRecipients.activityId, activities.id))
      .where(eq(activities.tournamentId, s.tournament.id));
    expect(recipients.every((r) => r.kind === "register")).toBe(true);
    expect(new Set(recipients.map((r) => r.userId))).toEqual(new Set([s.captainId, s.organizerId]));

    // myRegistration của đội trưởng phản ánh đơn mới; registeredTeams chỉ đếm đội approved.
    const detail = TournamentDetailSchema.parse(
      (await s.captain.request("GET", `/api/tournaments/${s.tournament.slug}`)).json(),
    );
    expect(detail.myRole).toBe("captain");
    expect(detail.myRegistration?.id).toBe(reg.id);
    expect(detail.myRegistration?.status).toBe("pending");
    expect(detail.registeredTeams).toBe(0);
  });

  it("401 khi chưa đăng nhập", async () => {
    const s = await setup();
    const guest = new TestClient(s.testApp.app);
    await guest.fetchCsrf();
    const res = await guest.request("POST", s.url, { payload: teamBody(["cap_a", ...s.mates.slice(0, 4)]) });
    expect(res.statusCode).toBe(401);
    expect(ErrorBodySchema.parse(res.json()).error.code).toBe("UNAUTHENTICATED");
  });

  it("403 CSRF khi thiếu hoặc sai token", async () => {
    const s = await setup();
    const payload = teamBody(["cap_a", ...s.mates.slice(0, 4)]);
    const missing = await s.captain.request("POST", s.url, { payload, csrf: null });
    expect(missing.statusCode).toBe(403);
    expect(missing.json().error.code).toBe("CSRF");
    const wrong = await s.captain.request("POST", s.url, { payload, csrf: "nonce.bad" });
    expect(wrong.statusCode).toBe(403);
    expect(wrong.json().error.code).toBe("CSRF");
  });

  it("400 khi body sai schema, người gửi không trong members, hoặc username không tồn tại", async () => {
    const s = await setup();
    const short = await s.captain.request("POST", s.url, { payload: teamBody(["cap_a", "mate_1"]) });
    expect(short.statusCode).toBe(400);
    expect(short.json().error.code).toBe("VALIDATION");

    const notMember = await s.captain.request("POST", s.url, {
      payload: teamBody(s.mates.slice(0, 5)),
    });
    expect(notMember.statusCode).toBe(400);

    const ghost = await s.captain.request("POST", s.url, {
      payload: teamBody(["cap_a", "mate_1", "mate_2", "mate_3", "khong_co_ai"]),
    });
    expect(ghost.statusCode).toBe(400);
    expect(ghost.json().error.message).toContain("khong_co_ai");
  });

  it("404 khi giải không tồn tại", async () => {
    const s = await setup();
    const res = await s.captain.request("POST", "/api/tournaments/khong-co-giai/registrations", {
      payload: teamBody(["cap_a", ...s.mates.slice(0, 4)]),
    });
    expect(res.statusCode).toBe(404);
  });

  it("409 kèm tên người khi thành viên đã có đội active trong giải", async () => {
    const s = await setup();
    await insertPendingTeam(s.testApp.db, s.tournament.id, "Đội Cũ", s.mates.slice(0, 5));
    const res = await s.captain.request("POST", s.url, {
      payload: teamBody(["cap_a", "mate_2", "mate_6", ...(await insertUsers(s.testApp.db, "x", 2))]),
    });
    expect(res.statusCode).toBe(409);
    const { error } = ErrorBodySchema.parse(res.json());
    expect(error.code).toBe("CONFLICT");
    expect(error.message).toContain("@mate_2");
    expect(error.message).not.toContain("@mate_6");
  });

  it("409 khi tên đội trùng (không phân biệt hoa thường)", async () => {
    const s = await setup();
    const others = await insertUsers(s.testApp.db, "o", 5);
    await insertPendingTeam(s.testApp.db, s.tournament.id, "Rồng Lửa", others);
    const res = await s.captain.request("POST", s.url, {
      payload: teamBody(["cap_a", ...s.mates.slice(0, 4)], [], "  RỒNG LỬA "),
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.message).toContain("Tên đội");
  });

  it("409 khi quá hạn đăng ký", async () => {
    const now = Date.now();
    const s = await setup({
      registrationDeadline: new Date(now - DAY),
      drawDate: new Date(now + DAY),
    });
    const res = await s.captain.request("POST", s.url, { payload: teamBody(["cap_a", ...s.mates.slice(0, 4)]) });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.message).toContain("quá hạn");
  });

  it("409 khi giải không còn open", async () => {
    const s = await setup({ status: "live" });
    const res = await s.captain.request("POST", s.url, { payload: teamBody(["cap_a", ...s.mates.slice(0, 4)]) });
    expect(res.statusCode).toBe(409);
  });

  it("409 khi đã đủ teamCount đội approved", async () => {
    const s = await setup();
    for (let i = 0; i < 4; i++) {
      const members = await insertUsers(s.testApp.db, `full${i}`, 5);
      const teamId = await insertPendingTeam(s.testApp.db, s.tournament.id, `Đội ${i}`, members);
      await s.testApp.db.update(tournamentTeams).set({ status: "approved" }).where(eq(tournamentTeams.id, teamId));
    }
    const res = await s.captain.request("POST", s.url, { payload: teamBody(["cap_a", ...s.mates.slice(0, 4)]) });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.message).toContain("đủ đội");
  });
});

describe("GET /api/tournaments/:slug/registrations", () => {
  it("BTC thấy mọi đơn; người khác 403; khách 401", async () => {
    const s = await setup();
    await s.captain.request("POST", s.url, { payload: teamBody(["cap_a", ...s.mates.slice(0, 4)]) });

    const ok = await s.organizer.request("GET", s.url);
    expect(ok.statusCode).toBe(200);
    const list = RegistrationsResponseSchema.parse(ok.json());
    expect(list).toHaveLength(1);
    expect(list[0]!.status).toBe("pending");

    const forbidden = await s.captain.request("GET", s.url);
    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.json().error.code).toBe("FORBIDDEN");

    const guest = await new TestClient(s.testApp.app).request("GET", s.url);
    expect(guest.statusCode).toBe(401);
  });
});

describe("POST …/registrations/:id/approve | reject", () => {
  it("approve tới đủ teamCount, lần sau 409; registeredTeams cập nhật", async () => {
    const s = await setup();
    const teamIds: string[] = [];
    for (let i = 0; i < 5; i++) {
      const members = await insertUsers(s.testApp.db, `ap${i}`, 5);
      teamIds.push(await insertPendingTeam(s.testApp.db, s.tournament.id, `Đội ${i}`, members));
    }
    for (const id of teamIds.slice(0, 4)) {
      const res = await s.organizer.request("POST", `${s.url}/${id}/approve`);
      expect(res.statusCode).toBe(200);
      expect(RegistrationResponseSchema.parse(res.json()).status).toBe("approved");
    }
    const fifth = await s.organizer.request("POST", `${s.url}/${teamIds[4]}/approve`);
    expect(fifth.statusCode).toBe(409);
    expect(fifth.json().error.code).toBe("CONFLICT");

    const again = await s.organizer.request("POST", `${s.url}/${teamIds[0]}/approve`);
    expect(again.statusCode).toBe(409);

    const detail = TournamentDetailSchema.parse(
      (await s.organizer.request("GET", `/api/tournaments/${s.tournament.slug}`)).json(),
    );
    expect(detail.registeredTeams).toBe(4);
    expect(detail.teamList).toHaveLength(4);
  });

  it("403 khi không phải BTC; 403 CSRF; 404 đơn lạ; 400 id sai", async () => {
    const s = await setup();
    const teamId = await insertPendingTeam(s.testApp.db, s.tournament.id, "Đội X", s.mates.slice(0, 5));
    const notOrganizer = await s.captain.request("POST", `${s.url}/${teamId}/approve`);
    expect(notOrganizer.statusCode).toBe(403);
    expect(notOrganizer.json().error.code).toBe("FORBIDDEN");
    const rejectByOther = await s.captain.request("POST", `${s.url}/${teamId}/reject`, { payload: {} });
    expect(rejectByOther.statusCode).toBe(403);

    const csrf = await s.organizer.request("POST", `${s.url}/${teamId}/approve`, { csrf: null });
    expect(csrf.statusCode).toBe(403);
    expect(csrf.json().error.code).toBe("CSRF");

    const unknown = await s.organizer.request("POST", `${s.url}/${randomUUID()}/approve`);
    expect(unknown.statusCode).toBe(404);
    const badId = await s.organizer.request("POST", `${s.url}/not-a-uuid/approve`);
    expect(badId.statusCode).toBe(400);
  });

  it("409 khi giải không open", async () => {
    const s = await setup();
    const teamId = await insertPendingTeam(s.testApp.db, s.tournament.id, "Đội X", s.mates.slice(0, 5));
    await s.testApp.db.update(tournaments).set({ status: "live" }).where(eq(tournaments.id, s.tournament.id));
    expect((await s.organizer.request("POST", `${s.url}/${teamId}/approve`)).statusCode).toBe(409);
    expect((await s.organizer.request("POST", `${s.url}/${teamId}/reject`, { payload: {} })).statusCode).toBe(409);
  });

  it("reject kèm lý do → thành viên inactive và đăng ký được đội khác", async () => {
    const s = await setup();
    const created = await s.captain.request("POST", s.url, {
      payload: teamBody(["cap_a", ...s.mates.slice(0, 4)]),
    });
    const reg = RegistrationResponseSchema.parse(created.json());

    const rejected = await s.organizer.request("POST", `${s.url}/${reg.id}/reject`, {
      payload: { reason: "Thiếu thông tin liên hệ" },
    });
    expect(rejected.statusCode).toBe(200);
    const body = RegistrationResponseSchema.parse(rejected.json());
    expect(body.status).toBe("rejected");
    expect(body.rejectReason).toBe("Thiếu thông tin liên hệ");

    const active = await s.testApp.db
      .select()
      .from(tournamentTeamMembers)
      .where(and(eq(tournamentTeamMembers.teamId, reg.id), eq(tournamentTeamMembers.active, true)));
    expect(active).toHaveLength(0);

    // Đội trưởng vẫn thấy đơn bị từ chối kèm lý do.
    const detail = TournamentDetailSchema.parse(
      (await s.captain.request("GET", `/api/tournaments/${s.tournament.slug}`)).json(),
    );
    expect(detail.myRegistration?.status).toBe("rejected");
    expect(detail.myRegistration?.rejectReason).toBe("Thiếu thông tin liên hệ");

    // Thành viên cũ đăng ký đội khác (tên khác) được.
    const again = await s.captain.request("POST", s.url, {
      payload: teamBody(["cap_a", "mate_1", "mate_2", "mate_5", "mate_6"], [], "Rồng Băng"),
    });
    expect(again.statusCode).toBe(201);
  });
});

describe("DELETE /api/tournaments/:slug/registrations/:id", () => {
  it("đội trưởng rút đơn → withdrawn, thành viên inactive (204)", async () => {
    const s = await setup();
    const reg = RegistrationResponseSchema.parse(
      (await s.captain.request("POST", s.url, { payload: teamBody(["cap_a", ...s.mates.slice(0, 4)]) })).json(),
    );

    const forbidden = await s.organizer.request("DELETE", `${s.url}/${reg.id}`);
    expect(forbidden.statusCode).toBe(403);
    const csrf = await s.captain.request("DELETE", `${s.url}/${reg.id}`, { csrf: null });
    expect(csrf.statusCode).toBe(403);
    expect(csrf.json().error.code).toBe("CSRF");

    const res = await s.captain.request("DELETE", `${s.url}/${reg.id}`);
    expect(res.statusCode).toBe(204);
    expect(res.body).toBe("");

    const [team] = await s.testApp.db.select().from(tournamentTeams).where(eq(tournamentTeams.id, reg.id));
    expect(team!.status).toBe("withdrawn");
    const active = await s.testApp.db
      .select()
      .from(tournamentTeamMembers)
      .where(and(eq(tournamentTeamMembers.teamId, reg.id), eq(tournamentTeamMembers.active, true)));
    expect(active).toHaveLength(0);

    const twice = await s.captain.request("DELETE", `${s.url}/${reg.id}`);
    expect(twice.statusCode).toBe(409);

    const list = RegistrationsResponseSchema.parse((await s.organizer.request("GET", s.url)).json());
    expect(list[0]!.status).toBe("withdrawn");
  });

  it("409 khi giải đã đóng", async () => {
    const s = await setup();
    const reg = RegistrationResponseSchema.parse(
      (await s.captain.request("POST", s.url, { payload: teamBody(["cap_a", ...s.mates.slice(0, 4)]) })).json(),
    );
    await s.testApp.db.update(tournaments).set({ status: "live" }).where(eq(tournaments.id, s.tournament.id));
    expect((await s.captain.request("DELETE", `${s.url}/${reg.id}`)).statusCode).toBe(409);
  });
});
