import {
  ErrorBodySchema,
  SearchResponseSchema,
  UserSummarySchema,
} from "@customaov/contracts";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { rooms } from "../db/schema.js";
import { escapeLike } from "../services/search.js";
import {
  createLoggedInClient,
  createSeededTestApp,
  TestClient,
  type TestApp,
} from "../test/helpers.js";

const apps: TestApp[] = [];
const SEED_PASSWORD = "customaov123";

async function setupSeeded(): Promise<{ testApp: TestApp; client: TestClient }> {
  const testApp = await createSeededTestApp();
  apps.push(testApp);
  return { testApp, client: new TestClient(testApp.app) };
}

const search = (client: TestClient, q: string, remoteAddress?: string) =>
  client.request("GET", `/api/search?q=${encodeURIComponent(q)}`, {
    ...(remoteAddress ? { remoteAddress } : {}),
  });

afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()));
});

describe("GET /api/search", () => {
  it('"giao luu" khớp phòng "Giao lưu cộng đồng #07" (không dấu, công khai)', async () => {
    const { client } = await setupSeeded();

    const res = await search(client, "giao luu");
    expect(res.statusCode).toBe(200);

    const body = SearchResponseSchema.parse(res.json());
    expect(body.rooms.map((r) => r.code)).toEqual(["AOV-1025"]);
    expect(body.rooms[0]?.title).toBe("Giao lưu cộng đồng #07");
  });

  it("chấp nhận từ khoá có dấu và hoa thường giống không dấu", async () => {
    const { client } = await setupSeeded();

    const accented = SearchResponseSchema.parse((await search(client, "GIAO LƯU")).json());
    const plain = SearchResponseSchema.parse((await search(client, "giao luu")).json());
    expect(accented).toEqual(plain);
  });

  it('"ngu kiet" khớp giải Ngũ Kiệt Cup', async () => {
    const { client } = await setupSeeded();

    const res = await search(client, "ngu kiet");
    expect(res.statusCode).toBe(200);

    const body = SearchResponseSchema.parse(res.json());
    expect(body.tournaments.map((t) => t.slug)).toContain("ngu-kiet-cup-mua-1");
    expect(body.tournaments.every((t) => t.name.length > 0)).toBe(true);
  });

  it("khách không thấy phòng private", async () => {
    const { client } = await setupSeeded();

    const body = SearchResponseSchema.parse((await search(client, "keo")).json());
    // Cả 2 phòng "Kèo …" (AOV-1024, AOV-1028) đều private.
    expect(body.rooms).toEqual([]);
  });

  it("thành viên thấy phòng private của mình, không thấy phòng private của người khác", async () => {
    const { client } = await setupSeeded();
    const login = await client.login("suthy", SEED_PASSWORD);
    expect(login.statusCode).toBe(200);

    const body = SearchResponseSchema.parse((await search(client, "keo")).json());
    const codes = body.rooms.map((r) => r.code);
    expect(codes).toContain("AOV-1024");
    expect(codes).not.toContain("AOV-1028");
    expect(body.rooms.find((r) => r.code === "AOV-1024")?.isMember).toBe(true);
  });

  it("người dùng khác (không là thành viên) không thấy phòng private", async () => {
    const { testApp } = await setupSeeded();
    const { client } = await createLoggedInClient(testApp.app, "outsider", "Người Ngoài");

    const body = SearchResponseSchema.parse((await search(client, "keo")).json());
    expect(body.rooms).toEqual([]);
  });

  it("người dùng chỉ trả UserSummary (không lộ uid, bio, password…)", async () => {
    const { client } = await setupSeeded();

    const res = await search(client, "suthy");
    expect(res.statusCode).toBe(200);
    const body = SearchResponseSchema.parse(res.json());
    expect(body.users.map((u) => u.username)).toContain("suthy");

    const raw = res.json() as { users: Record<string, unknown>[] };
    const allowed = Object.keys(UserSummarySchema.shape).sort();
    for (const user of raw.users) {
      expect(Object.keys(user).sort()).toEqual(allowed);
    }
  });

  it("mỗi nhóm tối đa 5 kết quả", async () => {
    const { client } = await setupSeeded();

    // "aov" khớp mã phòng; "an" phổ biến trong tên tiếng Việt.
    for (const q of ["aov", "an", "cup"]) {
      const body = SearchResponseSchema.parse((await search(client, q)).json());
      expect(body.rooms.length).toBeLessThanOrEqual(5);
      expect(body.tournaments.length).toBeLessThanOrEqual(5);
      expect(body.users.length).toBeLessThanOrEqual(5);
    }
  });

  it("q 1 ký tự → 400 VALIDATION", async () => {
    const { client } = await setupSeeded();

    const res = await search(client, "a");
    expect(res.statusCode).toBe(400);
    expect(ErrorBodySchema.parse(res.json()).error.code).toBe("VALIDATION");
  });

  it("thiếu q hoặc q chỉ có khoảng trắng → 400", async () => {
    const { client } = await setupSeeded();

    const missing = await client.request("GET", "/api/search");
    expect(missing.statusCode).toBe(400);
    expect(ErrorBodySchema.parse(missing.json()).error.code).toBe("VALIDATION");

    const blank = await search(client, "  a ");
    expect(blank.statusCode).toBe(400);
  });

  it('"%" và "_" được escape, không làm khớp tất cả', async () => {
    const { client } = await setupSeeded();

    for (const q of ["%%", "__", "%_", "k%"]) {
      const res = await search(client, q);
      expect(res.statusCode).toBe(200);
      expect(SearchResponseSchema.parse(res.json())).toEqual({
        rooms: [],
        tournaments: [],
        users: [],
      });
    }
  });

  it("escapeLike escape \\, %, _", () => {
    expect(escapeLike("50%_a\\b")).toBe("50\\%\\_a\\\\b");
  });

  it("giới hạn 30 lần/phút/IP → 429 RATE_LIMITED", async () => {
    const { client } = await setupSeeded();
    const ip = "10.9.9.9";

    for (let i = 0; i < 30; i++) {
      const res = await search(client, "giao luu", ip);
      expect(res.statusCode).toBe(200);
    }
    const blocked = await search(client, "giao luu", ip);
    expect(blocked.statusCode).toBe(429);
    expect(ErrorBodySchema.parse(blocked.json()).error.code).toBe("RATE_LIMITED");
    expect(blocked.headers["retry-after"]).toBeDefined();

    const otherIp = await search(client, "giao luu", "10.9.9.10");
    expect(otherIp.statusCode).toBe(200);
  });

  it("không trả phòng đã kết thúc (finished) trong kết quả tìm kiếm", async () => {
    const { testApp, client } = await setupSeeded();

    await testApp.db
      .update(rooms)
      .set({ status: "finished" })
      .where(eq(rooms.code, "AOV-1025"));

    const res = await search(client, "giao luu");
    expect(res.statusCode).toBe(200);
    const body = SearchResponseSchema.parse(res.json());
    expect(body.rooms.map((r) => r.code)).not.toContain("AOV-1025");
  });
});
