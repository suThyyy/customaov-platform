import { CSRF_COOKIE, CSRF_HEADER } from "@customaov/contracts";
import { sql } from "drizzle-orm";
import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import type { Writable } from "node:stream";

import { buildApp } from "../app.js";
import { loadConfig, type AppConfig } from "../config.js";
import { closeDb, createDb, migrate, type DbClient } from "../db/client.js";
import { seedDatabase } from "../db/seed.js";

const migratedTestUrls = new Set<string>();

/**
 * Create a clean migrated database for tests.
 * Uses PGlite `memory://` by default, or PostgreSQL when `TEST_DATABASE_URL` is set
 * (truncating all tables between test cases so each test starts isolated).
 */
export async function createTestDb(): Promise<DbClient> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    const db = createDb("memory://");
    await migrate(db);
    return db;
  }

  const db = createDb(url);
  if (!migratedTestUrls.has(url)) {
    await migrate(db);
    migratedTestUrls.add(url);
  }
  await db.execute(sql`
    TRUNCATE TABLE
      activity_recipients,
      activities,
      bracket_matches,
      tournament_team_members,
      tournament_teams,
      tournaments,
      room_matches,
      room_messages,
      room_members,
      rooms,
      sessions,
      users
    RESTART IDENTITY CASCADE
  `);
  return db;
}

export interface TestApp {
  app: FastifyInstance;
  db: DbClient;
  config: AppConfig;
  close(): Promise<void>;
}

export interface TestAppOptions {
  loggerStream?: Writable;
  now?: () => Date;
  config?: Partial<AppConfig>;
}

/** Fresh app + migrated test database (`memory://` or `TEST_DATABASE_URL`). */
export async function createTestApp(opts: TestAppOptions = {}): Promise<TestApp> {
  const config: AppConfig = {
    ...loadConfig({ NODE_ENV: "test", LOG_LEVEL: "info" }),
    ...opts.config,
  };
  const db = await createTestDb();
  const app = buildApp({
    config,
    db,
    logger: opts.loggerStream ? true : false,
    ...(opts.loggerStream ? { loggerStream: opts.loggerStream } : {}),
    ...(opts.now ? { now: opts.now } : {}),
  });
  await app.ready();
  return {
    app,
    db,
    config,
    async close() {
      await app.close();
      await closeDb(db);
    },
  };
}

/** Fresh seeded app + PGlite `memory://` database. */
export async function createSeededTestApp(
  opts: TestAppOptions = {},
): Promise<TestApp> {
  const testApp = await createTestApp(opts);
  await seedDatabase(testApp.db, { nodeEnv: "test" });
  return testApp;
}

/** Minimal cookie jar + CSRF-aware client around `app.inject`. */
export class TestClient {
  readonly cookies = new Map<string, string>();

  constructor(readonly app: FastifyInstance) {}

  cookieHeader(): string {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  absorb(response: LightMyRequestResponse): void {
    for (const c of response.cookies) {
      if (c.value === "" || (c.expires && c.expires.getTime() < Date.now())) {
        this.cookies.delete(c.name);
      } else {
        this.cookies.set(c.name, c.value);
      }
    }
  }

  async request(
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    url: string,
    opts: {
      payload?: unknown;
      csrf?: string | null;
      headers?: Record<string, string>;
      remoteAddress?: string;
    } = {},
  ): Promise<LightMyRequestResponse> {
    const csrf = opts.csrf === undefined ? this.cookies.get(CSRF_COOKIE) : opts.csrf;
    const response = await this.app.inject({
      method,
      url,
      ...(opts.remoteAddress ? { remoteAddress: opts.remoteAddress } : {}),
      headers: {
        ...(this.cookies.size ? { cookie: this.cookieHeader() } : {}),
        ...(csrf ? { [CSRF_HEADER]: csrf } : {}),
        ...opts.headers,
      },
      ...(opts.payload !== undefined ? { payload: opts.payload as object } : {}),
    });
    this.absorb(response);
    return response;
  }

  /** GET /api/auth/csrf so subsequent writes carry a valid anon token. */
  async fetchCsrf(opts: { remoteAddress?: string } = {}): Promise<string> {
    const res = await this.request("GET", "/api/auth/csrf", opts);
    return (res.json() as { csrfToken: string }).csrfToken;
  }

  async register(
    username: string,
    password: string,
    displayName = username,
    opts: { remoteAddress?: string } = {},
  ) {
    if (!this.cookies.has(CSRF_COOKIE)) await this.fetchCsrf(opts);
    return this.request("POST", "/api/auth/register", {
      payload: { username, password, displayName },
      ...(opts.remoteAddress ? { remoteAddress: opts.remoteAddress } : {}),
    });
  }

  async login(
    username: string,
    password: string,
    opts: { remoteAddress?: string } = {},
  ) {
    if (!this.cookies.has(CSRF_COOKIE)) await this.fetchCsrf(opts);
    return this.request("POST", "/api/auth/login", {
      payload: { username, password },
      ...(opts.remoteAddress ? { remoteAddress: opts.remoteAddress } : {}),
    });
  }
}

export async function createLoggedInClient(
  app: FastifyInstance,
  username: string,
  displayName = username,
  opts: { password?: string; remoteAddress?: string } = {},
): Promise<{ client: TestClient; userId: string }> {
  const client = new TestClient(app);
  const res = await client.register(
    username,
    opts.password ?? "password123",
    displayName,
    opts.remoteAddress ? { remoteAddress: opts.remoteAddress } : {},
  );
  if (res.statusCode !== 201) {
    throw new Error(`Failed to register ${username}: ${res.statusCode} ${res.body}`);
  }
  const { user } = res.json() as { user: { id: string } };
  return { client, userId: user.id };
}

export async function createLoggedInClients(
  app: FastifyInstance,
  count: number,
  prefix = "user",
): Promise<Array<{ client: TestClient; userId: string; username: string }>> {
  const result: Array<{ client: TestClient; userId: string; username: string }> = [];
  for (let i = 0; i < count; i++) {
    const username = `${prefix}_${i + 1}`;
    const remoteAddress = `10.0.${Math.floor(i / 250)}.${(i % 250) + 1}`;
    const { client, userId } = await createLoggedInClient(app, username, `Player ${i + 1}`, {
      remoteAddress,
    });
    result.push({ client, userId, username });
  }
  return result;
}
