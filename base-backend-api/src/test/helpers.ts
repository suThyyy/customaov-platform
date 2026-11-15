import { CSRF_COOKIE, CSRF_HEADER } from "@customaov/contracts";
import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import type { Writable } from "node:stream";

import { buildApp } from "../app.js";
import { loadConfig, type AppConfig } from "../config.js";
import { closeDb, createDb, migrate, type DbClient } from "../db/client.js";

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

/** Fresh app + PGlite `memory://` database with migrations applied. */
export async function createTestApp(opts: TestAppOptions = {}): Promise<TestApp> {
  const config: AppConfig = {
    ...loadConfig({ NODE_ENV: "test", LOG_LEVEL: "info" }),
    ...opts.config,
  };
  const db = createDb("memory://");
  await migrate(db);
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
