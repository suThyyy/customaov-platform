import {
  ActivitiesResponseSchema,
  ErrorBodySchema,
  RoomDetailSchema,
} from "@customaov/contracts";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { activities, activityRecipients, rooms } from "../db/schema.js";
import {
  createLoggedInClient,
  createTestApp,
  TestClient,
  type TestApp,
} from "../test/helpers.js";

let current: TestApp | undefined;
afterEach(async () => {
  await current?.close();
  current = undefined;
});

/** Đồng hồ tăng 1 phút mỗi lần đọc, để thứ tự "mới nhất ở trên" xác định được. */
function steppingClock(start = Date.parse("2026-11-15T03:00:00.000Z")) {
  let t = start;
  return () => new Date((t += 60_000));
}

async function setup() {
  current = await createTestApp({ now: steppingClock() });
  return current;
}

async function insertActivity(
  app: TestApp,
  recipientIds: string[],
  text: string,
  createdAt: Date,
  extra: Partial<typeof activities.$inferInsert> = {},
) {
  const id = randomUUID();
  await app.db.insert(activities).values({ id, kind: "register", text, createdAt, ...extra });
  if (recipientIds.length) {
    await app.db
      .insert(activityRecipients)
      .values(recipientIds.map((userId) => ({ activityId: id, userId })));
  }
  return id;
}

const ROOM_BODY = {
  title: "Phòng hoạt động",
  highlight: "5v5",
  mode: "normal" as const,
  visibility: "public" as const,
  config: {
    format: "5v5" as const,
    pickMode: "draft" as const,
    series: "BO1" as const,
    tools: ["balance", "chat"] as Array<"balance" | "chat">,
    notes: "",
  },
};

describe("GET /api/activities", () => {
  it("401 khi chưa đăng nhập", async () => {
    const app = await setup();
    const res = await new TestClient(app.app).request("GET", "/api/activities");
    expect(res.statusCode).toBe(401);
    expect(ErrorBodySchema.parse(res.json()).error.code).toBe("UNAUTHENTICATED");
  });

  it("400 khi query phân trang sai schema", async () => {
    const app = await setup();
    const { client } = await createLoggedInClient(app.app, "act_bad");
    const res = await client.request("GET", "/api/activities?pageSize=100");
    expect(res.statusCode).toBe(400);
    expect(ErrorBodySchema.parse(res.json()).error.code).toBe("VALIDATION");
  });

  it("chỉ trả hoạt động mà mình là recipient, đúng contract", async () => {
    const app = await setup();
    const a = await createLoggedInClient(app.app, "act_a", "Người A", { remoteAddress: "10.1.0.1" });
    const b = await createLoggedInClient(app.app, "act_b", "Người B", { remoteAddress: "10.1.0.2" });
    const base = Date.parse("2026-11-15T01:00:00.000Z");
    await insertActivity(app, [a.userId], "Chỉ A", new Date(base), { emphasis: "Thắng", kind: "result" });
    await insertActivity(app, [b.userId], "Chỉ B", new Date(base + 1000));
    await insertActivity(app, [a.userId, b.userId], "Cả hai", new Date(base + 2000));
    await insertActivity(app, [], "Không ai", new Date(base + 3000));

    const res = await a.client.request("GET", "/api/activities");
    expect(res.statusCode).toBe(200);
    const body = ActivitiesResponseSchema.parse(res.json());
    expect(body.total).toBe(2);
    expect(body.items.map((i) => i.text)).toEqual(["Cả hai", "Chỉ A"]);
    expect(body.items[1]).toMatchObject({
      kind: "result",
      emphasis: "Thắng",
      at: new Date(base).toISOString(),
    });
    expect(body.items[0]).not.toHaveProperty("emphasis");

    const resB = ActivitiesResponseSchema.parse(
      (await b.client.request("GET", "/api/activities")).json(),
    );
    expect(resB.items.map((i) => i.text)).toEqual(["Cả hai", "Chỉ B"]);
  });

  it("phân trang mới nhất ở trên, total đầy đủ", async () => {
    const app = await setup();
    const a = await createLoggedInClient(app.app, "act_page");
    const base = Date.parse("2026-11-01T00:00:00.000Z");
    for (let i = 0; i < 12; i++) {
      await insertActivity(app, [a.userId], `Mục ${i}`, new Date(base + i * 60_000));
    }

    const page1 = ActivitiesResponseSchema.parse(
      (await a.client.request("GET", "/api/activities?page=1&pageSize=5")).json(),
    );
    expect(page1).toMatchObject({ total: 12, page: 1, pageSize: 5 });
    expect(page1.items.map((i) => i.text)).toEqual(["Mục 11", "Mục 10", "Mục 9", "Mục 8", "Mục 7"]);

    const page3 = ActivitiesResponseSchema.parse(
      (await a.client.request("GET", "/api/activities?page=3&pageSize=5")).json(),
    );
    expect(page3.items.map((i) => i.text)).toEqual(["Mục 1", "Mục 0"]);

    const page9 = ActivitiesResponseSchema.parse(
      (await a.client.request("GET", "/api/activities?page=9&pageSize=5")).json(),
    );
    expect(page9).toMatchObject({ items: [], total: 12, page: 9 });

    const defaults = ActivitiesResponseSchema.parse(
      (await a.client.request("GET", "/api/activities")).json(),
    );
    expect(defaults).toMatchObject({ page: 1, pageSize: 10 });
    expect(defaults.items).toHaveLength(10);
  });
});

describe("activity join khi vào phòng", () => {
  it("vào phòng với vai người chơi sinh activity join cho người vào và chủ phòng (một lần)", async () => {
    const app = await setup();
    const host = await createLoggedInClient(app.app, "act_host", "Chủ Phòng", { remoteAddress: "10.2.0.1" });
    const player = await createLoggedInClient(app.app, "act_player", "Người Chơi", { remoteAddress: "10.2.0.2" });
    const outsider = await createLoggedInClient(app.app, "act_out", "Người Ngoài", { remoteAddress: "10.2.0.3" });

    const created = await host.client.request("POST", "/api/rooms", { payload: ROOM_BODY });
    expect(created.statusCode).toBe(201);
    const room = RoomDetailSchema.parse(created.json());

    const join = await player.client.request("POST", `/api/rooms/${room.code}/join`, {
      payload: { as: "player" },
    });
    expect(join.statusCode).toBe(200);

    for (const who of [player, host]) {
      const feed = ActivitiesResponseSchema.parse(
        (await who.client.request("GET", "/api/activities")).json(),
      );
      expect(feed.total).toBe(1);
      expect(feed.items[0]).toMatchObject({
        kind: "join",
        text: 'Người Chơi đã vào phòng "Phòng hoạt động"',
      });
    }
    const outsiderFeed = ActivitiesResponseSchema.parse(
      (await outsider.client.request("GET", "/api/activities")).json(),
    );
    expect(outsiderFeed.total).toBe(0);

    // Rời rồi vào lại: không sinh thêm mục trùng.
    expect(
      (await player.client.request("POST", `/api/rooms/${room.code}/leave`)).statusCode,
    ).toBe(200);
    expect(
      (
        await player.client.request("POST", `/api/rooms/${room.code}/join`, {
          payload: { as: "player" },
        })
      ).statusCode,
    ).toBe(200);

    const [dbRoom] = await app.db.select().from(rooms).where(eq(rooms.code, room.code));
    const joins = await app.db
      .select()
      .from(activities)
      .where(and(eq(activities.roomId, dbRoom!.id), eq(activities.kind, "join")));
    expect(joins).toHaveLength(1);
    expect(joins[0]?.actorId).toBe(player.userId);
    const recipients = await app.db
      .select()
      .from(activityRecipients)
      .where(eq(activityRecipients.activityId, joins[0]!.id));
    expect(recipients.map((r) => r.userId).sort()).toEqual([host.userId, player.userId].sort());
  });

  it("vào xem (spectator) không sinh activity join", async () => {
    const app = await setup();
    const host = await createLoggedInClient(app.app, "act_host2", "Chủ 2", { remoteAddress: "10.3.0.1" });
    const viewer = await createLoggedInClient(app.app, "act_view", "Khán Giả", { remoteAddress: "10.3.0.2" });
    const room = RoomDetailSchema.parse(
      (await host.client.request("POST", "/api/rooms", { payload: ROOM_BODY })).json(),
    );
    const res = await viewer.client.request("POST", `/api/rooms/${room.code}/join`, {
      payload: { as: "spectator" },
    });
    expect(res.statusCode).toBe(200);

    for (const who of [viewer, host]) {
      const feed = ActivitiesResponseSchema.parse(
        (await who.client.request("GET", "/api/activities")).json(),
      );
      expect(feed.total).toBe(0);
    }
  });
});
