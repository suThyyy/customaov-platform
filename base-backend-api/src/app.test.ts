import { Writable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "./app.js";
import type { AppConfig } from "./config.js";
import { createLoggedInClient, createSeededTestApp, type TestApp } from "./test/helpers.js";

const testConfig: AppConfig = {
  HOST: "127.0.0.1",
  PORT: 6174,
  LOG_LEVEL: "info",
  NODE_ENV: "test",
  DATABASE_URL: "memory://",
  CSRF_SECRET: "test-csrf-secret-0123456789",
  ALLOWED_ORIGINS: ["http://localhost:5174"],
};

const apps: ReturnType<typeof buildApp>[] = [];
const testApps: TestApp[] = [];

afterEach(async () => {
  await Promise.all([
    ...apps.splice(0).map((app) => app.close()),
    ...testApps.splice(0).map((t) => t.close()),
  ]);
});

describe("API application", () => {
  it("returns the health status", async () => {
    const app = buildApp({ config: testConfig, logger: false });
    apps.push(app);

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });

  it("returns the standard JSON error for an unknown route", async () => {
    const app = buildApp({ config: testConfig, logger: false });
    apps.push(app);

    const response = await app.inject({ method: "GET", url: "/missing" });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: { code: "NOT_FOUND", message: "Không tìm thấy đường dẫn" },
    });
  });

  it("redacts cookie and CSRF header values from logs", async () => {
    let output = "";
    const loggerStream = new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
      },
    });
    const app = buildApp({ config: testConfig, loggerStream });
    apps.push(app);
    app.get("/redact-probe", async (request) => {
      request.log.info({ req: { headers: request.headers } }, "redaction probe");
      return { status: "ok" };
    });

    const cookie = "session=top-secret-cookie";
    const csrfToken = "top-secret-csrf-token";
    const response = await app.inject({
      method: "GET",
      url: "/redact-probe",
      headers: {
        cookie,
        "x-csrf-token": csrfToken,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(output).toContain("[REDACTED]");
    expect(output).not.toContain(cookie);
    expect(output).not.toContain(csrfToken);
  });

  it("rate limits write requests at 60/min per user without affecting other users", async () => {
    const testApp = await createSeededTestApp();
    testApps.push(testApp);

    const { client: user1 } = await createLoggedInClient(testApp.app, "ratelimit1");
    const { client: user2 } = await createLoggedInClient(testApp.app, "ratelimit2");

    // 60 write requests (e.g. POST /api/rooms/AOV-1024/split which has no route-specific limit)
    for (let i = 0; i < 60; i += 1) {
      const res = await user1.request("POST", "/api/rooms/AOV-1024/split", {
        payload: { mode: "random" },
      });
      expect(res.statusCode).not.toBe(429);
    }

    // 61st write request for user1 is blocked with 429 RATE_LIMITED + retry-after
    const blocked = await user1.request("POST", "/api/rooms/AOV-1024/split", {
      payload: { mode: "random" },
    });
    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers["retry-after"]).toBeDefined();
    expect(blocked.json()).toMatchObject({
      error: { code: "RATE_LIMITED" },
    });

    // user2 is not affected
    const other = await user2.request("POST", "/api/rooms", {
      payload: {
        title: "Phòng user2",
        mode: "normal",
        visibility: "public",
        config: {
          format: "5v5",
          pickMode: "draft",
          series: "BO1",
          tools: ["balance"],
          notes: "",
        },
      },
    });
    expect(other.statusCode).toBe(201);
  });
});

