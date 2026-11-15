import { Writable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "./app.js";
import type { AppConfig } from "./config.js";

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

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
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
      error: { code: "NOT_FOUND", message: "Route not found" },
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
});

