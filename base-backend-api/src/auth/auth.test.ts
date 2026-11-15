import { Writable } from "node:stream";
import { createHash } from "node:crypto";
import {
  AuthResponseSchema,
  CsrfResponseSchema,
  ErrorBodySchema,
  MeResponseSchema,
} from "@customaov/contracts";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { sessions, users } from "../db/schema.js";
import { createTestApp, TestClient, type TestApp } from "../test/helpers.js";
import { issueCsrfToken, validateCsrf } from "./csrf.js";
import { SESSION_TTL_MS } from "./session.js";

const PASSWORD = "correct-horse-battery";
const DAY = 24 * 60 * 60 * 1000;

let current: TestApp | undefined;
afterEach(async () => {
  await current?.close();
  current = undefined;
});

async function setup(opts: Parameters<typeof createTestApp>[0] = {}) {
  current = await createTestApp(opts);
  return { t: current, c: new TestClient(current.app) };
}

describe("csrf helpers", () => {
  it("binds the token to the session", () => {
    const token = issueCsrfToken("secret-secret-secret", "hashA");
    expect(validateCsrf("secret-secret-secret", token, token, "hashA")).toBe(true);
    expect(validateCsrf("secret-secret-secret", token, token, "hashB")).toBe(false);
    expect(validateCsrf("secret-secret-secret", token, token, null)).toBe(false);
    expect(validateCsrf("other-secret-secret!", token, token, "hashA")).toBe(false);
    expect(validateCsrf("secret-secret-secret", token, undefined, "hashA")).toBe(false);
  });
});

describe("GET /api/auth/csrf", () => {
  it("returns a token and sets a readable csrf cookie", async () => {
    const { c } = await setup();
    const res = await c.request("GET", "/api/auth/csrf");
    expect(res.statusCode).toBe(200);
    const body = CsrfResponseSchema.parse(res.json());
    const cookie = res.cookies.find((x) => x.name === "csrf");
    expect(cookie?.value).toBe(body.csrfToken);
    expect(cookie?.httpOnly).toBeFalsy();
    expect(cookie?.sameSite).toBe("Lax");
  });
});

describe("POST /api/auth/register", () => {
  it("creates the user, session cookie and returns 201", async () => {
    const { t, c } = await setup();
    const res = await c.register("SuThy", PASSWORD, "Su Thy");
    expect(res.statusCode).toBe(201);
    const body = AuthResponseSchema.parse(res.json());
    expect(body.user.username).toBe("suthy");
    expect(body.user.uid).toMatch(/^\d{6}$/);
    expect(JSON.stringify(body)).not.toContain("passwordHash");

    const sid = res.cookies.find((x) => x.name === "sid");
    expect(sid?.httpOnly).toBe(true);
    expect(sid?.sameSite).toBe("Lax");
    expect(sid?.path).toBe("/");
    expect(sid?.secure).toBeFalsy();
    expect(res.cookies.some((x) => x.name === "csrf")).toBe(true);

    const [row] = await t.db.select().from(sessions);
    expect(row?.tokenHash).toBe(createHash("sha256").update(sid!.value).digest("hex"));
    expect(row?.tokenHash).not.toBe(sid!.value);
    const [user] = await t.db.select().from(users).where(eq(users.username, "suthy"));
    expect(user?.passwordHash.startsWith("scrypt$")).toBe(true);
  });

  it("marks cookies Secure in production", async () => {
    const { c } = await setup({ config: { NODE_ENV: "production" } });
    const res = await c.register("prod_user", PASSWORD);
    expect(res.statusCode).toBe(201);
    expect(res.cookies.find((x) => x.name === "sid")?.secure).toBe(true);
    expect(res.cookies.find((x) => x.name === "csrf")?.secure).toBe(true);
  });

  it("rejects a duplicate username with 409", async () => {
    const { c } = await setup();
    await c.register("dupe", PASSWORD);
    const other = new TestClient(current!.app);
    const res = await other.register("DUPE", PASSWORD);
    expect(res.statusCode).toBe(409);
    expect(ErrorBodySchema.parse(res.json()).error.code).toBe("CONFLICT");
  });

  it("rejects an invalid body with 400 VALIDATION", async () => {
    const { c } = await setup();
    await c.fetchCsrf();
    const res = await c.request("POST", "/api/auth/register", {
      payload: { username: "a!", password: "short" },
    });
    expect(res.statusCode).toBe(400);
    const body = ErrorBodySchema.parse(res.json());
    expect(body.error.code).toBe("VALIDATION");
    expect(Array.isArray(body.error.details)).toBe(true);
  });

  it("rate limits registration to 5 per hour per IP", async () => {
    const { c } = await setup();
    await c.fetchCsrf();
    for (let i = 0; i < 5; i++) {
      const res = await c.request("POST", "/api/auth/register", {
        payload: { username: `user_${i}`, password: PASSWORD, displayName: "x" },
      });
      expect(res.statusCode).toBe(201);
    }
    const res = await c.request("POST", "/api/auth/register", {
      payload: { username: "user_9", password: PASSWORD, displayName: "x" },
    });
    expect(res.statusCode).toBe(429);
    expect(ErrorBodySchema.parse(res.json()).error.code).toBe("RATE_LIMITED");
  });
});

describe("POST /api/auth/login", () => {
  it("logs in with correct credentials", async () => {
    const { t, c } = await setup();
    await c.register("player1", PASSWORD);
    const fresh = new TestClient(t.app);
    const res = await fresh.login("player1", PASSWORD);
    expect(res.statusCode).toBe(200);
    expect(AuthResponseSchema.parse(res.json()).user.username).toBe("player1");
    expect(res.cookies.some((x) => x.name === "sid" && x.httpOnly)).toBe(true);
  });

  it("returns the same generic 401 for wrong password and unknown user", async () => {
    const { t, c } = await setup();
    await c.register("player2", PASSWORD);
    const a = await new TestClient(t.app).login("player2", "wrong-password-1");
    const b = await new TestClient(t.app).login("nobody_here", "wrong-password-1");
    expect(a.statusCode).toBe(401);
    expect(b.statusCode).toBe(401);
    expect(a.json()).toEqual(b.json());
    expect(ErrorBodySchema.parse(a.json()).error.code).toBe("UNAUTHENTICATED");
  });

  it("rejects an invalid body with 400", async () => {
    const { c } = await setup();
    await c.fetchCsrf();
    const res = await c.request("POST", "/api/auth/login", { payload: { username: "x" } });
    expect(res.statusCode).toBe(400);
  });

  it("rate limits: the 6th attempt within a minute gets 429", async () => {
    const { c } = await setup();
    await c.fetchCsrf();
    const codes: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await c.request("POST", "/api/auth/login", {
        payload: { username: `ghost_${i}`, password: "wrong-password-1" },
      });
      codes.push(res.statusCode);
      if (i === 5) {
        expect(ErrorBodySchema.parse(res.json()).error.code).toBe("RATE_LIMITED");
      }
    }
    expect(codes).toEqual([401, 401, 401, 401, 401, 429]);
  });
});

describe("GET /api/auth/me", () => {
  it("returns user null and a csrf token for guests", async () => {
    const { c } = await setup();
    const res = await c.request("GET", "/api/auth/me");
    expect(res.statusCode).toBe(200);
    const body = MeResponseSchema.parse(res.json());
    expect(body.user).toBeNull();
    expect(res.cookies.find((x) => x.name === "csrf")?.value).toBe(body.csrfToken);
  });

  it("returns the user when logged in and keeps the existing csrf cookie", async () => {
    const { c } = await setup();
    await c.register("player3", PASSWORD, "Player Three");
    const csrf = c.cookies.get("csrf");
    const res = await c.request("GET", "/api/auth/me");
    const body = MeResponseSchema.parse(res.json());
    expect(body.user?.username).toBe("player3");
    expect(body.user?.displayName).toBe("Player Three");
    expect(body.csrfToken).toBe(csrf);
    expect(res.cookies.some((x) => x.name === "csrf")).toBe(false);
  });
});

describe("POST /api/auth/logout", () => {
  it("deletes the session and clears the cookie", async () => {
    const { t, c } = await setup();
    await c.register("player4", PASSWORD);
    const res = await c.request("POST", "/api/auth/logout");
    expect(res.statusCode).toBe(204);
    expect(c.cookies.has("sid")).toBe(false);
    expect(await t.db.select().from(sessions)).toHaveLength(0);
    const me = MeResponseSchema.parse((await c.request("GET", "/api/auth/me")).json());
    expect(me.user).toBeNull();
  });
});

describe("CSRF enforcement", () => {
  it("rejects writes without the header", async () => {
    const { c } = await setup();
    await c.fetchCsrf();
    const res = await c.request("POST", "/api/auth/login", {
      csrf: null,
      payload: { username: "someone", password: PASSWORD },
    });
    expect(res.statusCode).toBe(403);
    expect(ErrorBodySchema.parse(res.json()).error.code).toBe("CSRF");
  });

  it("rejects a header that differs from the cookie", async () => {
    const { c } = await setup();
    await c.fetchCsrf();
    const other = issueCsrfToken(current!.config.CSRF_SECRET, null);
    const res = await c.request("POST", "/api/auth/logout", { csrf: other });
    expect(res.statusCode).toBe(403);
  });

  it("rejects an anon token used after login (bound to another session)", async () => {
    const { c } = await setup();
    const anon = await c.fetchCsrf();
    await c.register("player5", PASSWORD);
    c.cookies.set("csrf", anon);
    const res = await c.request("POST", "/api/auth/logout", { csrf: anon });
    expect(res.statusCode).toBe(403);
    expect(ErrorBodySchema.parse(res.json()).error.code).toBe("CSRF");
  });

  it("rejects an unsigned token even when header equals cookie", async () => {
    const { c } = await setup();
    c.cookies.set("csrf", "forged-token");
    const res = await c.request("POST", "/api/auth/logout", { csrf: "forged-token" });
    expect(res.statusCode).toBe(403);
  });

  it("accepts a valid token and issues a fresh csrf cookie on logout", async () => {
    const { c } = await setup();
    await c.register("player6", PASSWORD);
    const before = c.cookies.get("csrf");
    const res = await c.request("POST", "/api/auth/logout");
    expect(res.statusCode).toBe(204);
    expect(c.cookies.get("csrf")).not.toBe(before);
    // New anon token works for the next write.
    const login = await c.request("POST", "/api/auth/login", {
      payload: { username: "player6", password: PASSWORD },
    });
    expect(login.statusCode).toBe(200);
  });
});

describe("session lifetime", () => {
  it("expires after 30 days", async () => {
    let now = new Date("2026-11-15T00:00:00Z");
    const { t, c } = await setup({ now: () => now });
    await c.register("player7", PASSWORD);
    now = new Date(now.getTime() + SESSION_TTL_MS + 1000);
    const res = await c.request("GET", "/api/auth/me");
    expect(MeResponseSchema.parse(res.json()).user).toBeNull();
    expect(await t.db.select().from(sessions)).toHaveLength(0);
  });

  it("slides the expiry when less than 15 days remain, not before", async () => {
    let now = new Date("2026-11-15T00:00:00Z");
    const { t, c } = await setup({ now: () => now });
    await c.register("player8", PASSWORD);
    const [initial] = await t.db.select().from(sessions);
    const initialExpiry = initial!.expiresAt.getTime();
    expect(initialExpiry).toBe(now.getTime() + SESSION_TTL_MS);

    now = new Date(now.getTime() + 10 * DAY); // 20 days remain: no slide
    let res = await c.request("GET", "/api/auth/me");
    expect(MeResponseSchema.parse(res.json()).user?.username).toBe("player8");
    expect(res.cookies.some((x) => x.name === "sid")).toBe(false);
    expect((await t.db.select().from(sessions))[0]!.expiresAt.getTime()).toBe(initialExpiry);

    now = new Date(now.getTime() + 10 * DAY); // 10 days remain: slide
    res = await c.request("GET", "/api/auth/me");
    expect(res.cookies.some((x) => x.name === "sid")).toBe(true);
    expect((await t.db.select().from(sessions))[0]!.expiresAt.getTime()).toBe(
      now.getTime() + SESSION_TTL_MS,
    );
  });
});

describe("logging", () => {
  it("never logs passwords, cookies or csrf tokens", async () => {
    let output = "";
    const loggerStream = new Writable({
      write(chunk, _enc, cb) {
        output += chunk.toString();
        cb();
      },
    });
    const { c } = await setup({ loggerStream });
    const secretPassword = "super-secret-pass-123";
    await c.register("logger1", secretPassword);
    const sid = c.cookies.get("sid")!;
    const csrf = c.cookies.get("csrf")!;
    await c.request("GET", "/api/auth/me");
    await c.request("POST", "/api/auth/logout");
    await c.login("logger1", "wrong-password-xyz");
    await c.login("logger1", secretPassword);
    await c.request("POST", "/api/auth/login", { payload: { username: "x" } });
    await c.request("POST", "/api/auth/logout", { csrf: "bad-csrf-value-1" });

    expect(output.length).toBeGreaterThan(0);
    for (const secret of [secretPassword, "wrong-password-xyz", sid, csrf, "bad-csrf-value-1"]) {
      expect(output).not.toContain(secret);
    }
  });
});
