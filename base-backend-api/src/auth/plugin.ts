import { CSRF_COOKIE, CSRF_HEADER, SESSION_COOKIE, type Me } from "@customaov/contracts";
import type { FastifyInstance, FastifyReply } from "fastify";

import type { AppConfig } from "../config.js";
import type { DbClient } from "../db/client.js";
import { issueCsrfToken, validateCsrf } from "./csrf.js";
import { resolveSession, SESSION_TTL_MS } from "./session.js";

declare module "fastify" {
  interface FastifyRequest {
    user: Me | null;
    /** SHA-256 of the current session token (null for guests). */
    sessionHash: string | null;
  }
  interface FastifyInstance {
    authDeps: AuthDeps;
  }
}

export interface AuthDeps {
  config: AppConfig;
  db: DbClient;
  now: () => Date;
}

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function setSessionCookie(
  deps: AuthDeps,
  reply: FastifyReply,
  token: string,
  expiresAt: Date,
): void {
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: deps.config.NODE_ENV === "production",
    expires: expiresAt,
  });
}

export function setCsrfCookie(
  deps: AuthDeps,
  reply: FastifyReply,
  token: string,
): void {
  reply.setCookie(CSRF_COOKIE, token, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    secure: deps.config.NODE_ENV === "production",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

/** Issue a fresh CSRF token bound to the given session and set the cookie. */
export function issueCsrf(
  deps: AuthDeps,
  reply: FastifyReply,
  sessionHash: string | null,
): string {
  const token = issueCsrfToken(deps.config.CSRF_SECRET, sessionHash);
  setCsrfCookie(deps, reply, token);
  return token;
}

/**
 * Resolves the session cookie into `request.user` and enforces CSRF on
 * every write request under /api. Registered on the root context.
 */
export function registerAuthPlugin(app: FastifyInstance, deps: AuthDeps): void {
  // skip-override: hooks must live on the root context, after @fastify/cookie's hook.
  const plugin = async (instance: FastifyInstance): Promise<void> => {
    installAuth(instance, deps);
  };
  (plugin as unknown as Record<symbol, boolean>)[Symbol.for("skip-override")] = true;
  app.register(plugin);
}

function installAuth(app: FastifyInstance, deps: AuthDeps): void {
  app.decorate("authDeps", deps);
  app.decorateRequest("user", null);
  app.decorateRequest("sessionHash", null);

  app.addHook("onRequest", async (request, reply) => {
    request.user = null;
    request.sessionHash = null;

    const token = request.cookies[SESSION_COOKIE];
    if (token) {
      const session = await resolveSession(deps.db, token, deps.now());
      if (session) {
        request.user = session.user;
        request.sessionHash = session.tokenHash;
        if (session.renewed) {
          setSessionCookie(deps, reply, token, session.expiresAt);
        }
      } else {
        reply.clearCookie(SESSION_COOKIE, { path: "/" });
      }
    }

    const path = request.url.split("?")[0] ?? "";
    if (WRITE_METHODS.has(request.method) && path.startsWith("/api/")) {
      const header = request.headers[CSRF_HEADER];
      const ok = validateCsrf(
        deps.config.CSRF_SECRET,
        typeof header === "string" ? header : undefined,
        request.cookies[CSRF_COOKIE],
        request.sessionHash,
      );
      if (!ok) {
        return reply.status(403).send({
          error: { code: "CSRF", message: "CSRF token thiếu hoặc không hợp lệ" },
        });
      }
    }
  });
}
