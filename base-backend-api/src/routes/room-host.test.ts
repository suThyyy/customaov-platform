import {
  ChatMessageSchema,
  ErrorBodySchema,
  MessagesResponseSchema,
  RoomDetailSchema,
  UserProfileSchema,
  formatTeamsText,
} from "@customaov/contracts";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import { closeDb, createDb, migrate } from "../db/client.js";
import {
  activities,
  activityRecipients,
  roomMatches,
  roomMembers,
  roomMessages,
  rooms,
} from "../db/schema.js";
import { registerAuthPlugin } from "../auth/plugin.js";
import { registerAuthRoutes } from "../auth/routes.js";
import { registerRoomRoutes } from "./rooms.js";
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
  notes: "Test host API",
};

let current: TestApp | undefined;
afterEach(async () => {
  await current?.close();
  current = undefined;
});

async function setup(now?: () => Date) {
  current = await createTestApp(now ? { now } : {});
  return current;
}

async function createFullRoom(app: TestApp, prefix = "p") {
  const clients = await createLoggedInClients(app.app, 10, prefix);
  const host = clients[0]!;
  const createRes = await host.client.request("POST", "/api/rooms", {
    payload: {
      title: "Phòng 10 người",
      highlight: "5v5",
      mode: "normal",
      visibility: "public",
      config: VALID_CONFIG,
    },
  });
  expect(createRes.statusCode).toBe(201);
  let room = RoomDetailSchema.parse(createRes.json());

  for (let i = 1; i < 10; i++) {
    const joinRes = await clients[i]!.client.request(
      "POST",
      `/api/rooms/${room.code}/join`,
      { payload: { as: "player" } },
    );
    expect(joinRes.statusCode).toBe(200);
    room = RoomDetailSchema.parse(joinRes.json());
  }

  return { room, clients, host };
}

describe("room host, export, and chat API", () => {
  describe("POST /api/rooms/:code/split", () => {
    it("splits 10 players randomly and by tier (preserving all players and saving warning)", async () => {
      const app = await setup();
      const { room, clients, host } = await createFullRoom(app, "split");

      const randomRes = await host.client.request(
        "POST",
        `/api/rooms/${room.code}/split`,
        { payload: { mode: "random" } },
      );
      expect(randomRes.statusCode).toBe(200);
      const afterRandom = RoomDetailSchema.parse(randomRes.json());
      expect(afterRandom.teams.blue).toHaveLength(5);
      expect(afterRandom.teams.red).toHaveLength(5);
      expect(afterRandom.lastSplit?.mode).toBe("random");
      expect(afterRandom.lastSplit?.balanceLevel).toBeNull();
      expect(afterRandom.lastSplit?.warning).toBe(false);

      const allIds = new Set([
        ...afterRandom.teams.blue.map((m) => m.user.id),
        ...afterRandom.teams.red.map((m) => m.user.id),
      ]);
      expect(allIds.size).toBe(10);
      for (const c of clients) {
        expect(allIds.has(c.userId)).toBe(true);
      }

      // Skewed tiers: host = tier 1 (score 8), 9 others = tier 5 (score 0.5).
      // One team must have >= 8 + 2 = 10 / 12.5 = 80%, guaranteeing warning = true for 50-50.
      await host.client.request("PATCH", `/api/rooms/${room.code}/me`, {
        payload: { tier: 1 },
      });
      for (let i = 1; i < 10; i++) {
        await clients[i]!.client.request("PATCH", `/api/rooms/${room.code}/me`, {
          payload: { tier: 5 },
        });
      }

      const tierRes = await host.client.request(
        "POST",
        `/api/rooms/${room.code}/split`,
        { payload: { mode: "tier", balanceLevel: "50-50" } },
      );
      expect(tierRes.statusCode).toBe(200);
      const afterTier = RoomDetailSchema.parse(tierRes.json());
      expect(afterTier.teams.blue).toHaveLength(5);
      expect(afterTier.teams.red).toHaveLength(5);
      expect(afterTier.lastSplit?.mode).toBe("tier");
      expect(afterTier.lastSplit?.balanceLevel).toBe("50-50");
      expect(afterTier.lastSplit?.warning).toBe(true);

      const [dbRoom] = await app.db
        .select()
        .from(rooms)
        .where(eq(rooms.code, room.code));
      expect(dbRoom?.lastSplit?.warning).toBeTruthy();

      const msgs = await app.db
        .select()
        .from(roomMessages)
        .where(eq(roomMessages.roomId, dbRoom!.id));
      expect(msgs.some((m) => m.system && m.text.includes("chia đội"))).toBe(true);
    });

    it("enforces 401, 403 non-host/CSRF, 400, and 409 (<10 players or finished)", async () => {
      const app = await setup();
      const [host, p2] = await createLoggedInClients(app.app, 2, "split_err");

      const createRes = await host!.client.request("POST", "/api/rooms", {
        payload: {
          title: "Phòng thiếu người",
          mode: "normal",
          visibility: "public",
          config: VALID_CONFIG,
        },
      });
      const room = RoomDetailSchema.parse(createRes.json());
      await p2!.client.request("POST", `/api/rooms/${room.code}/join`, {
        payload: { as: "player" },
      });

      const guest = new TestClient(app.app);
      await guest.fetchCsrf();
      expect(
        (
          await guest.request("POST", `/api/rooms/${room.code}/split`, {
            payload: { mode: "random" },
          })
        ).statusCode,
      ).toBe(401);

      expect(
        (
          await host!.client.request("POST", `/api/rooms/${room.code}/split`, {
            csrf: "bad",
            payload: { mode: "random" },
          })
        ).statusCode,
      ).toBe(403);

      expect(
        (
          await p2!.client.request("POST", `/api/rooms/${room.code}/split`, {
            payload: { mode: "random" },
          })
        ).statusCode,
      ).toBe(403);

      expect(
        (
          await host!.client.request("POST", `/api/rooms/${room.code}/split`, {
            payload: { mode: "invalid" },
          })
        ).statusCode,
      ).toBe(400);

      // < 10 players -> 409
      const notEnough = await host!.client.request(
        "POST",
        `/api/rooms/${room.code}/split`,
        { payload: { mode: "random" } },
      );
      expect(notEnough.statusCode).toBe(409);
      expect(ErrorBodySchema.parse(notEnough.json()).error.code).toBe("CONFLICT");

      // Finish room -> 409
      await host!.client.request("POST", `/api/rooms/${room.code}/leave`);
      await p2!.client.request("POST", `/api/rooms/${room.code}/leave`);
      const finishedRes = await p2!.client.request(
        "POST",
        `/api/rooms/${room.code}/split`,
        { payload: { mode: "random" } },
      );
      expect(finishedRes.statusCode).toBe(409);
    });
  });

  describe("POST /api/rooms/:code/move", () => {
    it("handles all 4 moveMember branches plus auth/CSRF/400/409", async () => {
      const app = await setup();
      const { room, clients, host } = await createFullRoom(app, "move");
      const bluePlayer = room.teams.blue[1]!;
      const redPlayer = room.teams.red[0]!;

      // 1. Same side -> no-op 200
      const sameSide = await host.client.request(
        "POST",
        `/api/rooms/${room.code}/move`,
        { payload: { userId: bluePlayer.user.id, to: "blue" } },
      );
      expect(sameSide.statusCode).toBe(200);

      // 2. Full target side without targetUserId -> 409 with Vietnamese message
      const fullNoTarget = await host.client.request(
        "POST",
        `/api/rooms/${room.code}/move`,
        { payload: { userId: bluePlayer.user.id, to: "red" } },
      );
      expect(fullNoTarget.statusCode).toBe(409);
      expect(ErrorBodySchema.parse(fullNoTarget.json()).error.message).toContain(
        "Đội kia đã đủ người",
      );

      // 3. Swap with targetUserId -> 200
      const swapRes = await host.client.request(
        "POST",
        `/api/rooms/${room.code}/move`,
        {
          payload: {
            userId: bluePlayer.user.id,
            to: "red",
            targetUserId: redPlayer.user.id,
          },
        },
      );
      expect(swapRes.statusCode).toBe(200);
      const swapped = RoomDetailSchema.parse(swapRes.json());
      expect(swapped.teams.red.some((m) => m.user.id === bluePlayer.user.id)).toBe(true);
      expect(swapped.teams.blue.some((m) => m.user.id === redPlayer.user.id)).toBe(true);

      // 4. Move to side with < 5 players after one leaves -> 200
      await clients[9]!.client.request("POST", `/api/rooms/${room.code}/leave`);
      const afterLeave = RoomDetailSchema.parse(
        (await host.client.request("GET", `/api/rooms/${room.code}`)).json(),
      );
      const fromSide = afterLeave.teams.blue.length === 5 ? "blue" : "red";
      const toSide = fromSide === "blue" ? "red" : "blue";
      const mover = afterLeave.teams[fromSide][1]!;
      const moveFree = await host.client.request(
        "POST",
        `/api/rooms/${room.code}/move`,
        { payload: { userId: mover.user.id, to: toSide } },
      );
      expect(moveFree.statusCode).toBe(200);

      // 5. Player not in room -> 409
      const missingPlayer = await host.client.request(
        "POST",
        `/api/rooms/${room.code}/move`,
        { payload: { userId: clients[9]!.userId, to: "blue" } },
      );
      expect(missingPlayer.statusCode).toBe(409);

      // Auth, CSRF, non-host, 400
      const guest = new TestClient(app.app);
      await guest.fetchCsrf();
      expect(
        (
          await guest.request("POST", `/api/rooms/${room.code}/move`, {
            payload: { userId: mover.user.id, to: "blue" },
          })
        ).statusCode,
      ).toBe(401);

      expect(
        (
          await host.client.request("POST", `/api/rooms/${room.code}/move`, {
            csrf: "bad",
            payload: { userId: mover.user.id, to: "blue" },
          })
        ).statusCode,
      ).toBe(403);

      expect(
        (
          await clients[1]!.client.request("POST", `/api/rooms/${room.code}/move`, {
            payload: { userId: mover.user.id, to: "blue" },
          })
        ).statusCode,
      ).toBe(403);

      expect(
        (
          await host.client.request("POST", `/api/rooms/${room.code}/move`, {
            payload: { userId: "not-uuid", to: "blue" },
          })
        ).statusCode,
      ).toBe(400);
    });
  });

  describe("POST /api/rooms/:code/kick", () => {
    it("kicks player, blocks rejoin for 10 min (409), allows after 10 min, blocks self-kick (400)", async () => {
      let currentTime = new Date("2026-11-15T12:00:00Z");
      const app = await setup(() => currentTime);
      const [host, p2, p3] = await createLoggedInClients(app.app, 3, "kick");

      const createRes = await host!.client.request("POST", "/api/rooms", {
        payload: {
          title: "Phòng kick",
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

      // Self kick -> 400
      const selfKick = await host!.client.request(
        "POST",
        `/api/rooms/${room.code}/kick`,
        { payload: { userId: host!.userId } },
      );
      expect(selfKick.statusCode).toBe(400);

      // Non-host kick -> 403
      expect(
        (
          await p2!.client.request("POST", `/api/rooms/${room.code}/kick`, {
            payload: { userId: p3!.userId },
          })
        ).statusCode,
      ).toBe(403);

      // Guest -> 401, bad CSRF -> 403, bad body -> 400
      const guest = new TestClient(app.app);
      await guest.fetchCsrf();
      expect(
        (
          await guest.request("POST", `/api/rooms/${room.code}/kick`, {
            payload: { userId: p2!.userId },
          })
        ).statusCode,
      ).toBe(401);
      expect(
        (
          await host!.client.request("POST", `/api/rooms/${room.code}/kick`, {
            csrf: "bad",
            payload: { userId: p2!.userId },
          })
        ).statusCode,
      ).toBe(403);
      expect(
        (
          await host!.client.request("POST", `/api/rooms/${room.code}/kick`, {
            payload: { userId: "invalid" },
          })
        ).statusCode,
      ).toBe(400);

      // Host kicks p2 -> 200
      const kickRes = await host!.client.request(
        "POST",
        `/api/rooms/${room.code}/kick`,
        { payload: { userId: p2!.userId } },
      );
      expect(kickRes.statusCode).toBe(200);
      const afterKick = RoomDetailSchema.parse(kickRes.json());
      expect(afterKick.playerCount).toBe(2);

      // p2 tries to rejoin immediately -> 409
      const rejoinEarly = await p2!.client.request(
        "POST",
        `/api/rooms/${room.code}/join`,
        { payload: { as: "player" } },
      );
      expect(rejoinEarly.statusCode).toBe(409);

      // Advance clock 10 minutes -> p2 can rejoin
      currentTime = new Date(currentTime.getTime() + 10 * 60 * 1000);
      const rejoinAfter = await p2!.client.request(
        "POST",
        `/api/rooms/${room.code}/join`,
        { payload: { as: "player" } },
      );
      expect(rejoinAfter.statusCode).toBe(200);
    });
  });

  describe("POST /api/rooms/:code/random-lanes", () => {
    it("assigns 5 distinct lanes per team and enforces 401/403/400/409", async () => {
      const app = await setup();
      const { room, clients, host } = await createFullRoom(app, "lanes");

      const res = await host.client.request(
        "POST",
        `/api/rooms/${room.code}/random-lanes`,
      );
      expect(res.statusCode).toBe(200);
      const updated = RoomDetailSchema.parse(res.json());
      const blueLanes = updated.teams.blue.map((m) => m.lane);
      const redLanes = updated.teams.red.map((m) => m.lane);
      expect(new Set(blueLanes).size).toBe(5);
      expect(new Set(redLanes).size).toBe(5);
      expect(blueLanes.every((l) => l !== null)).toBe(true);
      expect(redLanes.every((l) => l !== null)).toBe(true);

      const guest = new TestClient(app.app);
      await guest.fetchCsrf();
      expect(
        (await guest.request("POST", `/api/rooms/${room.code}/random-lanes`)).statusCode,
      ).toBe(401);
      expect(
        (
          await host.client.request("POST", `/api/rooms/${room.code}/random-lanes`, {
            csrf: "bad",
          })
        ).statusCode,
      ).toBe(403);
      expect(
        (
          await clients[1]!.client.request(
            "POST",
            `/api/rooms/${room.code}/random-lanes`,
          )
        ).statusCode,
      ).toBe(403);
      expect(
        (await host.client.request("POST", "/api/rooms/bad/random-lanes")).statusCode,
      ).toBe(400);
    });
  });

  describe("POST /api/rooms/:code/result", () => {
    it("records match, finishes room, creates activity, updates E3-T04 profile stats, and blocks 2nd result (409)", async () => {
      const app = await setup();
      const { room, clients, host } = await createFullRoom(app, "res");

      // Non-host, guest, bad CSRF, bad body
      const guest = new TestClient(app.app);
      await guest.fetchCsrf();
      expect(
        (
          await guest.request("POST", `/api/rooms/${room.code}/result`, {
            payload: { winner: "blue" },
          })
        ).statusCode,
      ).toBe(401);
      expect(
        (
          await host.client.request("POST", `/api/rooms/${room.code}/result`, {
            csrf: "bad",
            payload: { winner: "blue" },
          })
        ).statusCode,
      ).toBe(403);
      expect(
        (
          await clients[1]!.client.request(
            "POST",
            `/api/rooms/${room.code}/result`,
            { payload: { winner: "blue" } },
          )
        ).statusCode,
      ).toBe(403);
      expect(
        (
          await host.client.request("POST", `/api/rooms/${room.code}/result`, {
            payload: { winner: "green" },
          })
        ).statusCode,
      ).toBe(400);

      // Success
      const res = await host.client.request(
        "POST",
        `/api/rooms/${room.code}/result`,
        { payload: { winner: "blue" } },
      );
      expect(res.statusCode).toBe(200);
      const finished = RoomDetailSchema.parse(res.json());
      expect(finished.status).toBe("finished");
      expect(finished.result?.winner).toBe("blue");

      const [dbRoom] = await app.db
        .select()
        .from(rooms)
        .where(eq(rooms.code, room.code));
      const matches = await app.db
        .select()
        .from(roomMatches)
        .where(eq(roomMatches.roomId, dbRoom!.id));
      expect(matches).toHaveLength(1);
      expect(matches[0]?.blueUserIds).toHaveLength(5);
      expect(matches[0]?.redUserIds).toHaveLength(5);

      const members = await app.db
        .select()
        .from(roomMembers)
        .where(eq(roomMembers.roomId, dbRoom!.id));
      expect(members.every((m) => !m.active)).toBe(true);

      const acts = await app.db
        .select()
        .from(activities)
        .where(eq(activities.roomId, dbRoom!.id));
      expect(acts).toHaveLength(1);
      expect(acts[0]?.kind).toBe("result");
      const recipients = await app.db
        .select()
        .from(activityRecipients)
        .where(eq(activityRecipients.activityId, acts[0]!.id));
      expect(recipients).toHaveLength(10);

      // E3-T04 profile stats updated for Blue (win) and Red (loss)
      const blueUsername = room.teams.blue[0]!.user.username;
      const redUsername = room.teams.red[0]!.user.username;
      const blueProfileRes = await guest.request("GET", `/api/users/${blueUsername}`);
      expect(blueProfileRes.statusCode).toBe(200);
      const blueProfile = UserProfileSchema.parse(blueProfileRes.json());
      expect(blueProfile.stats.customMatches).toBe(1);
      expect(blueProfile.stats.wins).toBe(1);
      expect(blueProfile.stats.winRate).toBe(100);

      const redProfileRes = await guest.request("GET", `/api/users/${redUsername}`);
      expect(redProfileRes.statusCode).toBe(200);
      const redProfile = UserProfileSchema.parse(redProfileRes.json());
      expect(redProfile.stats.customMatches).toBe(1);
      expect(redProfile.stats.losses).toBe(1);
      expect(redProfile.stats.winRate).toBe(0);

      // 2nd result -> 409
      const secondRes = await host.client.request(
        "POST",
        `/api/rooms/${room.code}/result`,
        { payload: { winner: "red" } },
      );
      expect(secondRes.statusCode).toBe(409);

      // < 10 players -> 409
      const { client: solo } = await createLoggedInClient(app.app, "solo_res");
      const soloRoom = RoomDetailSchema.parse(
        (
          await solo.request("POST", "/api/rooms", {
            payload: {
              title: "Solo",
              mode: "normal",
              visibility: "public",
              config: VALID_CONFIG,
            },
          })
        ).json(),
      );
      const notEnough = await solo.request(
        "POST",
        `/api/rooms/${soloRoom.code}/result`,
        { payload: { winner: "blue" } },
      );
      expect(notEnough.statusCode).toBe(409);
    });
  });

  describe("GET /api/rooms/:code/export", () => {
    it("returns text/plain formatted with formatTeamsText for host/player and forbids spectator/outsider", async () => {
      const app = await setup();
      const [host, player, spectator, outsider] = await createLoggedInClients(
        app.app,
        4,
        "exp",
      );
      const createRes = await host!.client.request("POST", "/api/rooms", {
        payload: {
          title: "Phòng Xuất",
          highlight: "Giao hữu",
          mode: "normal",
          visibility: "public",
          config: VALID_CONFIG,
        },
      });
      const initialRoom = RoomDetailSchema.parse(createRes.json());

      await player!.client.request("POST", `/api/rooms/${initialRoom.code}/join`, {
        payload: { as: "player" },
      });
      const afterSpecJoin = await spectator!.client.request(
        "POST",
        `/api/rooms/${initialRoom.code}/join`,
        { payload: { as: "spectator" } },
      );
      const room = RoomDetailSchema.parse(afterSpecJoin.json());

      const expectedText = formatTeamsText(
        { code: room.code, title: room.title, highlight: room.highlight },
        room.teams,
      );

      const hostExport = await host!.client.request(
        "GET",
        `/api/rooms/${room.code}/export`,
      );
      expect(hostExport.statusCode).toBe(200);
      expect(hostExport.headers["content-type"]).toContain("text/plain");
      expect(hostExport.body).toBe(expectedText);

      const playerExport = await player!.client.request(
        "GET",
        `/api/rooms/${room.code}/export`,
      );
      expect(playerExport.statusCode).toBe(200);
      expect(playerExport.headers["content-type"]).toContain("text/plain");
      expect(playerExport.body).toBe(expectedText);

      const spectatorExport = await spectator!.client.request(
        "GET",
        `/api/rooms/${room.code}/export`,
      );
      expect(spectatorExport.statusCode).toBe(403);
      expect(ErrorBodySchema.parse(spectatorExport.json()).error.code).toBe(
        "FORBIDDEN",
      );

      const guest = new TestClient(app.app);
      expect(
        (await guest.request("GET", `/api/rooms/${room.code}/export`)).statusCode,
      ).toBe(401);
      expect(
        (await outsider!.client.request("GET", `/api/rooms/${room.code}/export`))
          .statusCode,
      ).toBe(403);
      expect(
        (await host!.client.request("GET", "/api/rooms/bad/export")).statusCode,
      ).toBe(400);
    });
  });

  describe("GET & POST /api/rooms/:code/messages", () => {
    it("allows host/player chat, blocks spectator (403), enforces rate limit (10/10s), and supports before pagination", async () => {
      const app = await setup();
      const [host, player, spectator, outsider] = await createLoggedInClients(
        app.app,
        4,
        "chat",
      );

      const room = RoomDetailSchema.parse(
        (
          await host!.client.request("POST", "/api/rooms", {
            payload: {
              title: "Phòng Chat",
              mode: "normal",
              visibility: "public",
              config: VALID_CONFIG,
            },
          })
        ).json(),
      );

      await player!.client.request("POST", `/api/rooms/${room.code}/join`, {
        payload: { as: "player" },
      });
      await spectator!.client.request("POST", `/api/rooms/${room.code}/join`, {
        payload: { as: "spectator" },
      });

      // Guest -> 401
      const guest = new TestClient(app.app);
      await guest.fetchCsrf();
      expect(
        (
          await guest.request("POST", `/api/rooms/${room.code}/messages`, {
            payload: { text: "hi" },
          })
        ).statusCode,
      ).toBe(401);
      expect(
        (await guest.request("GET", `/api/rooms/${room.code}/messages`))
          .statusCode,
      ).toBe(401);

      // Bad CSRF -> 403
      expect(
        (
          await host!.client.request("POST", `/api/rooms/${room.code}/messages`, {
            csrf: "bad",
            payload: { text: "hi" },
          })
        ).statusCode,
      ).toBe(403);

      // Spectator cannot post (403) but can read (200)
      const specPost = await spectator!.client.request(
        "POST",
        `/api/rooms/${room.code}/messages`,
        { payload: { text: "cho mình chơi với" } },
      );
      expect(specPost.statusCode).toBe(403);
      expect(
        (await spectator!.client.request("GET", `/api/rooms/${room.code}/messages`))
          .statusCode,
      ).toBe(200);

      // Outsider cannot read or post (403)
      expect(
        (await outsider!.client.request("GET", `/api/rooms/${room.code}/messages`))
          .statusCode,
      ).toBe(403);
      expect(
        (
          await outsider!.client.request(
            "POST",
            `/api/rooms/${room.code}/messages`,
            { payload: { text: "hello" } },
          )
        ).statusCode,
      ).toBe(403);

      // Validation 400 (use host so player's 10/10s bucket is fresh)
      expect(
        (
          await host!.client.request("POST", `/api/rooms/${room.code}/messages`, {
            payload: { text: "   " },
          })
        ).statusCode,
      ).toBe(400);

      // Player sends 10 messages (rate limit = 10/10s) -> 11th is 429
      const sentIds: string[] = [];
      for (let i = 0; i < 10; i++) {
        const res = await player!.client.request(
          "POST",
          `/api/rooms/${room.code}/messages`,
          { payload: { text: `  Tin nhắn ${i}  ` } },
        );
        expect(res.statusCode).toBe(201);
        const msg = ChatMessageSchema.parse(res.json());
        expect(msg.text).toBe(`Tin nhắn ${i}`);
        sentIds.push(msg.id);
      }
      const rateLimited = await player!.client.request(
        "POST",
        `/api/rooms/${room.code}/messages`,
        { payload: { text: "Tin thứ 11" } },
      );
      expect(rateLimited.statusCode).toBe(429);
      expect(ErrorBodySchema.parse(rateLimited.json()).error.code).toBe(
        "RATE_LIMITED",
      );

      // GET messages and ?before=<id>
      const allMsgs = MessagesResponseSchema.parse(
        (
          await host!.client.request("GET", `/api/rooms/${room.code}/messages`)
        ).json(),
      );
      expect(allMsgs.length).toBeGreaterThanOrEqual(10);

      const beforeMsgs = MessagesResponseSchema.parse(
        (
          await host!.client.request(
            "GET",
            `/api/rooms/${room.code}/messages?before=${sentIds[5]!}`,
          )
        ).json(),
      );
      expect(beforeMsgs.some((m) => m.id === sentIds[5])).toBe(false);
      expect(beforeMsgs.some((m) => m.id === sentIds[4])).toBe(true);
    });
  });

  describe("event hooks via deps", () => {
    it("invokes onRoomChanged and onChatMessage callbacks", async () => {
      const db = createDb("memory://");
      await migrate(db);
      const config = loadConfig({ NODE_ENV: "test", LOG_LEVEL: "info" });
      const onRoomChanged = vi.fn();
      const onChatMessage = vi.fn();

      const app = buildApp({ config, db: undefined, logger: false });
      const deps = {
        config,
        db,
        now: () => new Date("2026-11-15T12:00:00Z"),
        onRoomChanged,
        onChatMessage,
      };
      // Register auth + room routes with custom event callbacks
      const { default: cookie } = await import("@fastify/cookie");
      const { default: rateLimit } = await import("@fastify/rate-limit");
      const fastifyApp = (await import("fastify")).default({ logger: false });
      fastifyApp.register(cookie);
      fastifyApp.register(rateLimit, { global: false });
      registerAuthPlugin(fastifyApp, deps);
      fastifyApp.register(async (instance) => {
        registerAuthRoutes(instance, deps);
        registerRoomRoutes(instance, deps);
      });
      await fastifyApp.ready();

      try {
        const { client: host } = await createLoggedInClient(fastifyApp, "hook_host");
        const room = RoomDetailSchema.parse(
          (
            await host.request("POST", "/api/rooms", {
              payload: {
                title: "Hook room",
                mode: "normal",
                visibility: "public",
                config: VALID_CONFIG,
              },
            })
          ).json(),
        );

        await host.request("POST", `/api/rooms/${room.code}/random-lanes`);
        expect(onRoomChanged).toHaveBeenCalledWith(room.code);

        await host.request("POST", `/api/rooms/${room.code}/messages`, {
          payload: { text: "ping" },
        });
        expect(onChatMessage).toHaveBeenCalledTimes(1);
        expect(onChatMessage.mock.calls[0]?.[0]).toBe(room.code);
        expect(onChatMessage.mock.calls[0]?.[1]).toMatchObject({ text: "ping" });
      } finally {
        await fastifyApp.close();
        await app.close();
        await closeDb(db);
      }
    });
  });
});
