import {
  ErrorBodySchema,
  RoomDetailResponseSchema,
  RoomDetailSchema,
  RoomsResponseSchema,
} from "@customaov/contracts";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { roomMembers, roomMessages, rooms } from "../db/schema.js";
import { seedDatabase } from "../db/seed.js";
import {
  createLoggedInClient,
  createLoggedInClients,
  createTestApp,
  TestClient,
  type TestApp,
} from "../test/helpers.js";

const VALID_CONFIG = {
  format: "5v5" as const,
  pickMode: "draft" as const,
  series: "BO1" as const,
  tools: ["balance", "lane", "chat"] as Array<
    "balance" | "lane" | "champion" | "mystery" | "chat"
  >,
  notes: "Giao hữu tối nay",
};

let current: TestApp | undefined;
afterEach(async () => {
  await current?.close();
  current = undefined;
});

async function setup() {
  current = await createTestApp();
  return current;
}

function extractKey(shareUrl: string | undefined): string {
  expect(shareUrl).toBeDefined();
  const idx = shareUrl!.indexOf("?key=");
  expect(idx).toBeGreaterThan(-1);
  return shareUrl!.slice(idx + 5);
}

describe("rooms API", () => {
  describe("POST /api/rooms", () => {
    it("creates a public room with host in Team Blue as captain", async () => {
      const app = await setup();
      const { client: host, userId } = await createLoggedInClient(app.app, "host1", "Host One");

      const res = await host.request("POST", "/api/rooms", {
        payload: {
          title: "Kèo giao lưu tối",
          highlight: "5v5 vui vẻ",
          mode: "normal",
          visibility: "public",
          config: VALID_CONFIG,
        },
      });

      expect(res.statusCode).toBe(201);
      const room = RoomDetailSchema.parse(res.json());
      expect(room.code).toMatch(/^AOV-\d{4,6}$/);
      expect(room.modeLabel).toBe("5v5 · Custom");
      expect(room.myRole).toBe("host");
      expect(room.isMember).toBe(true);
      expect(room.playerCount).toBe(1);
      expect(room.teams.blue).toHaveLength(1);
      expect(room.teams.red).toHaveLength(0);
      expect(room.teams.blue[0]?.user.id).toBe(userId);
      expect(room.teams.blue[0]?.captain).toBe(true);
      expect(room.shareUrl).toBe(`/rooms/${room.code}`);
    });

    it("creates a private room with join_key and shareUrl", async () => {
      const app = await setup();
      const { client: host } = await createLoggedInClient(app.app, "host_priv", "Host Priv");

      const res = await host.request("POST", "/api/rooms", {
        payload: {
          title: "Phòng riêng tư",
          mode: "tournament",
          visibility: "private",
          config: VALID_CONFIG,
        },
      });

      expect(res.statusCode).toBe(201);
      const room = RoomDetailSchema.parse(res.json());
      expect(room.visibility).toBe("private");
      expect(room.shareUrl).toMatch(new RegExp(`^/rooms/${room.code}\\?key=.+`));

      const [dbRow] = await app.db
        .select()
        .from(rooms)
        .where(eq(rooms.code, room.code));
      expect(dbRow?.joinKey).toBeTruthy();
    });

    it("rejects non-5v5 format with 400 and 'Sắp có' message", async () => {
      const app = await setup();
      const { client } = await createLoggedInClient(app.app, "host3v3");

      const res = await client.request("POST", "/api/rooms", {
        payload: {
          title: "Phòng 3v3",
          mode: "normal",
          visibility: "public",
          config: { ...VALID_CONFIG, format: "3v3" },
        },
      });

      expect(res.statusCode).toBe(400);
      const err = ErrorBodySchema.parse(res.json());
      expect(err.error.code).toBe("VALIDATION");
      expect(err.error.message).toContain("Sắp có");
    });

    it("enforces 401, 403 CSRF, and 400 validation", async () => {
      const app = await setup();
      const guest = new TestClient(app.app);
      await guest.fetchCsrf();
      const unauth = await guest.request("POST", "/api/rooms", {
        payload: {
          title: "Test",
          mode: "normal",
          visibility: "public",
          config: VALID_CONFIG,
        },
      });
      expect(unauth.statusCode).toBe(401);

      const { client } = await createLoggedInClient(app.app, "host_auth");
      const badCsrf = await client.request("POST", "/api/rooms", {
        csrf: "wrong-csrf",
        payload: {
          title: "Test",
          mode: "normal",
          visibility: "public",
          config: VALID_CONFIG,
        },
      });
      expect(badCsrf.statusCode).toBe(403);
      expect(ErrorBodySchema.parse(badCsrf.json()).error.code).toBe("CSRF");

      const badBody = await client.request("POST", "/api/rooms", {
        payload: { title: "", mode: "invalid" },
      });
      expect(badBody.statusCode).toBe(400);
      expect(ErrorBodySchema.parse(badBody.json()).error.code).toBe("VALIDATION");
    });
  });

  describe("GET /api/rooms", () => {
    it("filters public vs member rooms, mine=1, mode, status, and accent-insensitive q", async () => {
      const app = await setup();
      const [u1, u2] = await createLoggedInClients(app.app, 2, "list");

      await u1!.client.request("POST", "/api/rooms", {
        payload: {
          title: "Giao lưu cộng đồng",
          mode: "friendly",
          visibility: "public",
          config: VALID_CONFIG,
        },
      });
      await u2!.client.request("POST", "/api/rooms", {
        payload: {
          title: "Phòng kín của U2",
          mode: "tournament",
          visibility: "private",
          config: VALID_CONFIG,
        },
      });

      const guest = new TestClient(app.app);
      const guestList = await guest.request("GET", "/api/rooms");
      expect(guestList.statusCode).toBe(200);
      const guestParsed = RoomsResponseSchema.parse(guestList.json());
      expect(guestParsed.items).toHaveLength(1);
      expect(guestParsed.items[0]?.title).toBe("Giao lưu cộng đồng");

      const guestMine = await guest.request("GET", "/api/rooms?mine=1");
      expect(guestMine.statusCode).toBe(401);

      const u2List = await u2!.client.request("GET", "/api/rooms");
      expect(u2List.statusCode).toBe(200);
      expect(RoomsResponseSchema.parse(u2List.json()).items).toHaveLength(2);

      const u2Mine = await u2!.client.request("GET", "/api/rooms?mine=1");
      expect(u2Mine.statusCode).toBe(200);
      const u2MineParsed = RoomsResponseSchema.parse(u2Mine.json());
      expect(u2MineParsed.items).toHaveLength(1);
      expect(u2MineParsed.items[0]?.title).toBe("Phòng kín của U2");
      expect(u2MineParsed.items[0]?.isMember).toBe(true);

      const searchRes = await guest.request("GET", "/api/rooms?q=giao%20luu");
      expect(searchRes.statusCode).toBe(200);
      expect(RoomsResponseSchema.parse(searchRes.json()).items).toHaveLength(1);

      const modeRes = await guest.request("GET", "/api/rooms?mode=tournament");
      expect(modeRes.statusCode).toBe(200);
      expect(RoomsResponseSchema.parse(modeRes.json()).items).toHaveLength(0);

      const badQuery = await guest.request("GET", "/api/rooms?page=0");
      expect(badQuery.statusCode).toBe(400);
    });
  });

  describe("GET /api/rooms/:code", () => {
    it("handles private restriction, key access, and host-only shareUrl", async () => {
      const app = await setup();
      const [host, outsider] = await createLoggedInClients(app.app, 2, "detail");

      const createRes = await host!.client.request("POST", "/api/rooms", {
        payload: {
          title: "Phòng mật",
          mode: "normal",
          visibility: "private",
          config: VALID_CONFIG,
        },
      });
      const created = RoomDetailSchema.parse(createRes.json());
      const key = extractKey(created.shareUrl);

      const outsiderRes = await outsider!.client.request("GET", `/api/rooms/${created.code}`);
      expect(outsiderRes.statusCode).toBe(200);
      const restricted = RoomDetailResponseSchema.parse(outsiderRes.json());
      expect(restricted.restricted).toBe(true);
      expect("teams" in restricted).toBe(false);

      const withKeyRes = await outsider!.client.request(
        "GET",
        `/api/rooms/${created.code}?key=${encodeURIComponent(key)}`,
      );
      expect(withKeyRes.statusCode).toBe(200);
      const unlocked = RoomDetailResponseSchema.parse(withKeyRes.json());
      expect(unlocked.restricted).toBe(false);
      if (!unlocked.restricted) {
        expect(unlocked.shareUrl).toBeUndefined();
        expect(unlocked.teams.blue).toHaveLength(1);
      }

      const hostRes = await host!.client.request("GET", `/api/rooms/${created.code}`);
      const hostDetail = RoomDetailResponseSchema.parse(hostRes.json());
      expect(hostDetail.restricted).toBe(false);
      if (!hostDetail.restricted) {
        expect(hostDetail.shareUrl).toBe(created.shareUrl);
      }

      const badCode = await outsider!.client.request("GET", "/api/rooms/invalid-code");
      expect(badCode.statusCode).toBe(400);

      const missing = await outsider!.client.request("GET", "/api/rooms/AOV-999999");
      expect(missing.statusCode).toBe(404);
    });
  });

  describe("POST /api/rooms/:code/join", () => {
    it("balances teams (fewer / blue on tie), enforces 10-player cap and 1 active waiting room", async () => {
      const app = await setup();
      const clients = await createLoggedInClients(app.app, 11, "joiner");
      const host = clients[0]!;

      const createRes = await host.client.request("POST", "/api/rooms", {
        payload: {
          title: "Phòng 10 người",
          mode: "normal",
          visibility: "public",
          config: VALID_CONFIG,
        },
      });
      const room = RoomDetailSchema.parse(createRes.json());

      // Host is #1 (Blue). Player #2 should go to Red (Blue=1, Red=0).
      const j2 = await clients[1]!.client.request("POST", `/api/rooms/${room.code}/join`, {
        payload: { as: "player" },
      });
      expect(j2.statusCode).toBe(200);
      const d2 = RoomDetailSchema.parse(j2.json());
      expect(d2.teams.blue).toHaveLength(1);
      expect(d2.teams.red).toHaveLength(1);

      // Player #3: Blue=1, Red=1 (tie) -> Blue
      const j3 = await clients[2]!.client.request("POST", `/api/rooms/${room.code}/join`, {
        payload: { as: "player" },
      });
      expect(j3.statusCode).toBe(200);
      const d3 = RoomDetailSchema.parse(j3.json());
      expect(d3.teams.blue).toHaveLength(2);
      expect(d3.teams.red).toHaveLength(1);

      // Players #4..#10 join
      for (let i = 3; i < 10; i++) {
        const res = await clients[i]!.client.request("POST", `/api/rooms/${room.code}/join`, {
          payload: { as: "player" },
        });
        expect(res.statusCode).toBe(200);
      }

      // 11th player -> 409 CONFLICT
      const j11 = await clients[10]!.client.request("POST", `/api/rooms/${room.code}/join`, {
        payload: { as: "player" },
      });
      expect(j11.statusCode).toBe(409);
      expect(ErrorBodySchema.parse(j11.json()).error.code).toBe("CONFLICT");

      // 11th user can still join as spectator
      const specRes = await clients[10]!.client.request("POST", `/api/rooms/${room.code}/join`, {
        payload: { as: "spectator" },
      });
      expect(specRes.statusCode).toBe(200);
      expect(RoomDetailSchema.parse(specRes.json()).spectators).toHaveLength(1);

      // Player #2 tries to create or join a 2nd waiting room -> 409 with room.code
      const { client: otherHost } = await createLoggedInClient(app.app, "other_host");
      const room2Res = await otherHost.request("POST", "/api/rooms", {
        payload: {
          title: "Phòng thứ hai",
          mode: "normal",
          visibility: "public",
          config: VALID_CONFIG,
        },
      });
      const room2 = RoomDetailSchema.parse(room2Res.json());

      const conflictRes = await clients[1]!.client.request(
        "POST",
        `/api/rooms/${room2.code}/join`,
        { payload: { as: "player" } },
      );
      expect(conflictRes.statusCode).toBe(409);
      const conflictErr = ErrorBodySchema.parse(conflictRes.json());
      expect(conflictErr.error.code).toBe("CONFLICT");
      expect(conflictErr.error.message).toContain(room.code);

      // System messages recorded
      const [dbRoom] = await app.db
        .select({ id: rooms.id })
        .from(rooms)
        .where(eq(rooms.code, room.code));
      const msgs = await app.db
        .select()
        .from(roomMessages)
        .where(eq(roomMessages.roomId, dbRoom!.id));
      expect(msgs.some((m) => m.system && m.text.includes("đã vào phòng"))).toBe(true);
    });

    it("enforces private key, auth, CSRF, validation, and 10/min rate limit", async () => {
      const app = await setup();
      const [host, joiner, rlUser] = await createLoggedInClients(app.app, 3, "rl");

      const createRes = await host!.client.request("POST", "/api/rooms", {
        payload: {
          title: "Phòng private join",
          mode: "normal",
          visibility: "private",
          config: VALID_CONFIG,
        },
      });
      const room = RoomDetailSchema.parse(createRes.json());

      const guest = new TestClient(app.app);
      await guest.fetchCsrf();
      const unauth = await guest.request("POST", `/api/rooms/${room.code}/join`, {
        payload: { as: "player" },
      });
      expect(unauth.statusCode).toBe(401);

      const badCsrf = await joiner!.client.request("POST", `/api/rooms/${room.code}/join`, {
        csrf: "bad",
        payload: { as: "player" },
      });
      expect(badCsrf.statusCode).toBe(403);
      expect(ErrorBodySchema.parse(badCsrf.json()).error.code).toBe("CSRF");

      const badBody = await joiner!.client.request("POST", `/api/rooms/${room.code}/join`, {
        payload: { as: "invalid" },
      });
      expect(badBody.statusCode).toBe(400);

      // Wrong key -> 403 FORBIDDEN (10 times), 11th attempt -> 429 RATE_LIMITED
      for (let i = 0; i < 10; i++) {
        const res = await rlUser!.client.request("POST", `/api/rooms/${room.code}/join`, {
          payload: { as: "player", key: "wrong-key" },
        });
        expect(res.statusCode).toBe(403);
        expect(ErrorBodySchema.parse(res.json()).error.code).toBe("FORBIDDEN");
      }

      const limited = await rlUser!.client.request("POST", `/api/rooms/${room.code}/join`, {
        payload: { as: "player", key: "wrong-key" },
      });
      expect(limited.statusCode).toBe(429);
      expect(ErrorBodySchema.parse(limited.json()).error.code).toBe("RATE_LIMITED");
    });
  });

  describe("POST /api/rooms/:code/leave and finished state", () => {
    it("transfers host to earliest member, finishes when last leaves, and blocks writes on finished", async () => {
      const app = await setup();
      const [host, p2, p3] = await createLoggedInClients(app.app, 3, "leave");

      const createRes = await host!.client.request("POST", "/api/rooms", {
        payload: {
          title: "Phòng test rời",
          mode: "normal",
          visibility: "public",
          config: VALID_CONFIG,
        },
      });
      const room = RoomDetailSchema.parse(createRes.json());

      await p2!.client.request("POST", `/api/rooms/${room.code}/join`, {
        payload: { as: "player" },
      });
      await p3!.client.request("POST", `/api/rooms/${room.code}/join`, {
        payload: { as: "player" },
      });

      // Host leaves -> p2 (earliest) becomes host
      const hostLeave = await host!.client.request("POST", `/api/rooms/${room.code}/leave`);
      expect(hostLeave.statusCode).toBe(200);
      const afterHostLeave = RoomDetailSchema.parse(hostLeave.json());
      expect(afterHostLeave.host.id).toBe(p2!.userId);
      expect(afterHostLeave.playerCount).toBe(2);

      // p2 leaves -> p3 becomes host
      const p2Leave = await p2!.client.request("POST", `/api/rooms/${room.code}/leave`);
      expect(p2Leave.statusCode).toBe(200);
      expect(RoomDetailSchema.parse(p2Leave.json()).host.id).toBe(p3!.userId);

      // p3 (last member) leaves -> room finished, all members active=false
      const p3Leave = await p3!.client.request("POST", `/api/rooms/${room.code}/leave`);
      expect(p3Leave.statusCode).toBe(200);
      const finished = RoomDetailSchema.parse(p3Leave.json());
      expect(finished.status).toBe("finished");
      expect(finished.playerCount).toBe(0);

      const [dbRoom] = await app.db
        .select()
        .from(rooms)
        .where(eq(rooms.code, room.code));
      expect(dbRoom?.status).toBe("finished");
      expect(dbRoom?.finishedAt).not.toBeNull();

      const activeRows = await app.db
        .select()
        .from(roomMembers)
        .where(eq(roomMembers.roomId, dbRoom!.id));
      expect(activeRows.every((r) => !r.active)).toBe(true);

      // Writes on finished room -> 409 CONFLICT
      const joinFinished = await host!.client.request("POST", `/api/rooms/${room.code}/join`, {
        payload: { as: "player" },
      });
      expect(joinFinished.statusCode).toBe(409);

      const leaveFinished = await host!.client.request("POST", `/api/rooms/${room.code}/leave`);
      expect(leaveFinished.statusCode).toBe(409);

      const patchFinished = await host!.client.request("PATCH", `/api/rooms/${room.code}/me`, {
        payload: { ready: true },
      });
      expect(patchFinished.statusCode).toBe(409);
    });

    it("enforces 401, 403 CSRF, 403 non-member, 400 invalid code on leave", async () => {
      const app = await setup();
      const [host, outsider] = await createLoggedInClients(app.app, 2, "leave_err");

      const createRes = await host!.client.request("POST", "/api/rooms", {
        payload: {
          title: "Phòng leave auth",
          mode: "normal",
          visibility: "public",
          config: VALID_CONFIG,
        },
      });
      const room = RoomDetailSchema.parse(createRes.json());

      const guest = new TestClient(app.app);
      await guest.fetchCsrf();
      expect((await guest.request("POST", `/api/rooms/${room.code}/leave`)).statusCode).toBe(401);

      expect(
        (
          await host!.client.request("POST", `/api/rooms/${room.code}/leave`, {
            csrf: "wrong",
          })
        ).statusCode,
      ).toBe(403);

      const nonMember = await outsider!.client.request("POST", `/api/rooms/${room.code}/leave`);
      expect(nonMember.statusCode).toBe(403);
      expect(ErrorBodySchema.parse(nonMember.json()).error.code).toBe("FORBIDDEN");

      expect(
        (await host!.client.request("POST", "/api/rooms/bad/leave")).statusCode,
      ).toBe(400);
    });
  });

  describe("PATCH /api/rooms/:code/me", () => {
    it("updates lane, ready, tier and enforces 401, 403, 400", async () => {
      const app = await setup();
      const [host, spectator] = await createLoggedInClients(app.app, 2, "patch_me");

      const createRes = await host!.client.request("POST", "/api/rooms", {
        payload: {
          title: "Phòng patch me",
          mode: "normal",
          visibility: "public",
          config: VALID_CONFIG,
        },
      });
      const room = RoomDetailSchema.parse(createRes.json());

      await spectator!.client.request("POST", `/api/rooms/${room.code}/join`, {
        payload: { as: "spectator" },
      });

      const okRes = await host!.client.request("PATCH", `/api/rooms/${room.code}/me`, {
        payload: { lane: "MID", ready: true, tier: 4 },
      });
      expect(okRes.statusCode).toBe(200);
      const updated = RoomDetailSchema.parse(okRes.json());
      expect(updated.teams.blue[0]).toMatchObject({
        lane: "MID",
        ready: true,
        tier: 4,
      });

      const guest = new TestClient(app.app);
      await guest.fetchCsrf();
      expect(
        (
          await guest.request("PATCH", `/api/rooms/${room.code}/me`, {
            payload: { ready: false },
          })
        ).statusCode,
      ).toBe(401);

      expect(
        (
          await host!.client.request("PATCH", `/api/rooms/${room.code}/me`, {
            csrf: "wrong",
            payload: { ready: false },
          })
        ).statusCode,
      ).toBe(403);

      const specPatch = await spectator!.client.request(
        "PATCH",
        `/api/rooms/${room.code}/me`,
        { payload: { lane: "TOP" } },
      );
      expect(specPatch.statusCode).toBe(403);

      const emptyBody = await host!.client.request("PATCH", `/api/rooms/${room.code}/me`, {
        payload: {},
      });
      expect(emptyBody.statusCode).toBe(400);

      const badTier = await host!.client.request("PATCH", `/api/rooms/${room.code}/me`, {
        payload: { tier: 9 },
      });
      expect(badTier.statusCode).toBe(400);
    });
  });

  describe("seeded rooms", () => {
    it("allows suthy to view AOV-1024 and lists public rooms for guests", async () => {
      const app = await setup();
      await seedDatabase(app.db, { nodeEnv: "test" });

      const guest = new TestClient(app.app);
      const guestList = await guest.request("GET", "/api/rooms");
      expect(guestList.statusCode).toBe(200);
      const guestRooms = RoomsResponseSchema.parse(guestList.json());
      expect(guestRooms.items.map((r) => r.code).sort()).toEqual([
        "AOV-1025",
        "AOV-1026",
        "AOV-1027",
      ]);

      const guest1024 = await guest.request("GET", "/api/rooms/AOV-1024");
      expect(guest1024.statusCode).toBe(200);
      expect(RoomDetailResponseSchema.parse(guest1024.json()).restricted).toBe(true);

      const suthy = new TestClient(app.app);
      const loginRes = await suthy.login("suthy", "customaov123");
      expect(loginRes.statusCode).toBe(200);

      const suthy1024 = await suthy.request("GET", "/api/rooms/AOV-1024");
      expect(suthy1024.statusCode).toBe(200);
      const detail = RoomDetailResponseSchema.parse(suthy1024.json());
      expect(detail.restricted).toBe(false);
      if (!detail.restricted) {
        expect(detail.myRole).toBe("host");
        expect(detail.shareUrl).toMatch(/^\/rooms\/AOV-1024\?key=.+/);
        expect(detail.teams.blue).toHaveLength(5);
        expect(detail.teams.red).toHaveLength(5);
      }
    });
  });
});
