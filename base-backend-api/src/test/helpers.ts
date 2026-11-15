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
    opts: { payload?: unknown; csrf?: string | null; headers?: Record<string, string> } = {},
  ): Promise<LightMyRequestResponse> {
    const csrf = opts.csrf === undefined ? this.cookies.get(CSRF_COOKIE) : opts.csrf;
    const response = await this.app.inject({
      method,
      url,
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
  async fetchCsrf(): Promise<string> {
    const res = await this.request("GET", "/api/auth/csrf");
    return (res.json() as { csrfToken: string }).csrfToken;
  }

  async register(username: string, password: string, displayName = username) {
    if (!this.cookies.has(CSRF_COOKIE)) await this.fetchCsrf();
    return this.request("POST", "/api/auth/register", {
      payload: { username, password, displayName },
    });
  }

  async login(username: string, password: string) {
    if (!this.cookies.has(CSRF_COOKIE)) await this.fetchCsrf();
    return this.request("POST", "/api/auth/login", {
      payload: { username, password },
    });
  }
}
