import { randomInt } from "node:crypto";
import {
  CSRF_COOKIE,
  LoginBodySchema,
  RegisterBodySchema,
  normalizeVi,
  type AuthResponse,
  type CsrfResponse,
  type MeResponse,
} from "@customaov/contracts";
import { eq } from "drizzle-orm";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { SESSION_COOKIE } from "@customaov/contracts";

import { users } from "../db/schema.js";
import { hashPassword, verifyPassword } from "./password.js";
import { issueCsrf, setSessionCookie, type AuthDeps } from "./plugin.js";
import { verifyCsrfSignature } from "./csrf.js";
import { createSession, deleteSessionByHash, toMe } from "./session.js";

const GENERIC_LOGIN_ERROR = "Tên đăng nhập hoặc mật khẩu không đúng";

// Always verified against when the user doesn't exist, so response time doesn't leak existence.
let dummyHash: Promise<string> | undefined;
function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword("dummy-password-for-timing");
  return dummyHash;
}

class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function bodyUsername(request: FastifyRequest): string {
  const body = request.body;
  if (typeof body === "object" && body !== null) {
    const username = (body as Record<string, unknown>).username;
    if (typeof username === "string" && username.trim().length > 0) {
      return username.trim().toLowerCase();
    }
  }
  return "";
}

function lowerUsername(body: unknown): unknown {
  if (typeof body === "object" && body !== null) {
    const record = body as Record<string, unknown>;
    if (typeof record.username === "string") {
      return { ...record, username: record.username.trim().toLowerCase() };
    }
  }
  return body;
}

export function registerAuthRoutes(app: FastifyInstance, deps: AuthDeps): void {
  const { db, config } = deps;

  const rateLimited = (
    max: number,
    timeWindow: number,
    key: (request: FastifyRequest) => string,
  ) => {
    const check = app.createRateLimit({
      max,
      timeWindow,
      keyGenerator: key,
    });
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const res = await check(request);
      if (!res.isAllowed && res.isExceeded) {
        const seconds = Math.ceil(res.ttl / 1000);
        reply.header("retry-after", seconds);
        const error = new Error(
          `Bạn thao tác quá nhanh, thử lại sau ${seconds} giây`,
        ) as Error & { statusCode: number; code?: string };
        error.statusCode = 429;
        error.code = "RATE_LIMITED";
        throw error;
      }
    };
  };

  const loginIpLimit = rateLimited(5, 60_000, (r) => `login-ip:${r.ip}`);
  const loginPairLimit = rateLimited(10, 15 * 60_000, (r) => {
    const username = bodyUsername(r);
    return username ? `login-pair:${r.ip}:${username}` : `login-pair:${r.ip}`;
  });
  const registerLimit = rateLimited(5, 60 * 60_000, (r) => `register-ip:${r.ip}`);

  async function startSession(
    request: FastifyRequest,
    reply: FastifyReply,
    userId: string,
  ): Promise<void> {
    if (request.sessionHash) await deleteSessionByHash(db, request.sessionHash);
    const session = await createSession(db, userId, deps.now());
    setSessionCookie(deps, reply, session.token, session.expiresAt);
    issueCsrf(deps, reply, session.tokenHash);
  }

  app.get("/api/auth/csrf", async (request, reply): Promise<CsrfResponse> => {
    return { csrfToken: issueCsrf(deps, reply, request.sessionHash) };
  });

  app.get("/api/auth/me", async (request, reply): Promise<MeResponse> => {
    const existing = request.cookies[CSRF_COOKIE];
    const csrfToken =
      existing &&
      verifyCsrfSignature(config.CSRF_SECRET, existing, request.sessionHash)
        ? existing
        : issueCsrf(deps, reply, request.sessionHash);
    return { user: request.user, csrfToken };
  });

  app.post(
    "/api/auth/register",
    { preHandler: registerLimit },
    async (request, reply): Promise<AuthResponse> => {
      const body = RegisterBodySchema.parse(lowerUsername(request.body));
      const passwordHash = await hashPassword(body.password);
      const searchText = normalizeVi(`${body.displayName} ${body.username}`);

      for (let attempt = 0; attempt < 8; attempt++) {
        const uid = String(randomInt(0, 1_000_000)).padStart(6, "0");
        let created: typeof users.$inferSelect | undefined;
        try {
          [created] = await db
            .insert(users)
            .values({
              uid,
              username: body.username,
              displayName: body.displayName,
              passwordHash,
              searchText,
            })
            .returning();
        } catch (error) {
          // Unique violation: username taken (409) or uid collision (retry).
          const [existing] = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.username, body.username))
            .limit(1);
          if (existing) {
            throw new HttpError(409, "CONFLICT", "Tên đăng nhập đã được sử dụng");
          }
          if (attempt === 7) throw error;
          continue;
        }
        if (!created) throw new Error("Insert returned no row");
        await startSession(request, reply, created.id);
        reply.status(201);
        return { user: toMe(created) };
      }
      throw new Error("Could not allocate uid");
    },
  );

  app.post(
    "/api/auth/login",
    { preHandler: [loginIpLimit, loginPairLimit] },
    async (request, reply): Promise<AuthResponse> => {
      const body = LoginBodySchema.parse(lowerUsername(request.body));
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.username, body.username))
        .limit(1);

      const hash = user ? user.passwordHash : await getDummyHash();
      const ok = await verifyPassword(body.password, hash);
      if (!user || !ok) {
        throw new HttpError(401, "UNAUTHENTICATED", GENERIC_LOGIN_ERROR);
      }
      await startSession(request, reply, user.id);
      return { user: toMe(user) };
    },
  );

  app.post("/api/auth/logout", async (request, reply) => {
    if (request.sessionHash) await deleteSessionByHash(db, request.sessionHash);
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    issueCsrf(deps, reply, null);
    return reply.status(204).send();
  });
}
