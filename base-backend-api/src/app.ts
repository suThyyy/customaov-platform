import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import Fastify, {
  type FastifyInstance,
  type FastifyRequest,
} from "fastify";
import type { Writable } from "node:stream";
import { ZodError } from "zod";

import { registerAuthPlugin } from "./auth/plugin.js";
import { registerAuthRoutes } from "./auth/routes.js";
import { registerRoomRoutes } from "./routes/rooms.js";
import { registerUserRoutes } from "./routes/users.js";
import { loadConfig, type AppConfig } from "./config.js";
import type { DbClient } from "./db/client.js";
import { registerTournamentRoutes } from "./routes/tournaments.js";

const REDACT_PATHS = [
  "req.headers.cookie",
  "req.headers.authorization",
  'req.headers["x-csrf-token"]',
  'res.headers["set-cookie"]',
  "*.password",
  "*.token",
  "*.csrf",
  "*.csrfToken",
];

export interface BuildAppOptions {
  config?: AppConfig;
  /** Database client. When omitted, auth routes/CSRF are not registered (health-only app). */
  db?: DbClient;
  logger?: boolean;
  loggerStream?: Writable;
  /** Clock override for tests (session expiry). */
  now?: () => Date;
}

function codeForStatus(status: number): string {
  switch (status) {
    case 400:
      return "VALIDATION";
    case 401:
      return "UNAUTHENTICATED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 429:
      return "RATE_LIMITED";
    default:
      return "INTERNAL";
  }
}

export function buildApp(opts: BuildAppOptions = {}): FastifyInstance {
  const config = opts.config ?? loadConfig();
  const logger =
    opts.logger === false
      ? false
      : {
          level: config.LOG_LEVEL,
          serializers: {
            // Never log request bodies (auth routes carry passwords).
            req(request: FastifyRequest) {
              return {
                method: request.method,
                url: request.url,
                headers: request.headers,
              };
            },
          },
          redact: {
            paths: REDACT_PATHS,
            censor: "[REDACTED]",
          },
          ...(opts.loggerStream ? { stream: opts.loggerStream } : {}),
        };

  const app = Fastify({ logger });

  // Accept `Content-Type: application/json` with an empty body (e.g. logout).
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_request, body, done) => {
      const text = typeof body === "string" ? body : body.toString();
      if (text.length === 0) {
        done(null, undefined);
        return;
      }
      try {
        done(null, JSON.parse(text));
      } catch {
        const error = new Error("Body JSON không hợp lệ") as Error & {
          statusCode: number;
        };
        error.statusCode = 400;
        done(error, undefined);
      }
    },
  );

  app.register(cookie);
  app.register(rateLimit, {
    global: false,
    errorResponseBuilder: (_request, context) => {
      const error = new Error(
        `Bạn thao tác quá nhanh, thử lại sau ${Math.ceil(context.ttl / 1000)} giây`,
      ) as Error & { statusCode: number };
      error.statusCode = 429;
      return error;
    },
  });

  if (opts.db) {
    const deps = {
      config,
      db: opts.db,
      now: opts.now ?? (() => new Date()),
    };
    registerAuthPlugin(app, deps);
    app.register(async (instance) => {
      registerAuthRoutes(instance, deps);
      registerUserRoutes(instance, deps);
      registerRoomRoutes(instance, deps);
      registerTournamentRoutes(instance, deps);
    });
  }

  app.get("/health", async () => ({ status: "ok" }));

  app.setNotFoundHandler((_request, reply) => {
    return reply.status(404).send({
      error: {
        code: "NOT_FOUND",
        message: "Route not found",
      },
    });
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION",
          message: "Dữ liệu không hợp lệ",
          details: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
      });
    }

    const errorRecord =
      typeof error === "object" && error !== null
        ? (error as Record<string, unknown>)
        : {};
    const rawStatusCode = errorRecord.statusCode;
    const statusCode =
      typeof rawStatusCode === "number" && rawStatusCode >= 400
        ? rawStatusCode
        : 500;
    const code =
      typeof errorRecord.code === "string" &&
      /^[A-Z_]+$/.test(errorRecord.code) &&
      !errorRecord.code.startsWith("FST_")
        ? errorRecord.code
        : codeForStatus(statusCode);
    const errorMessage =
      error instanceof Error ? error.message : "Internal Server Error";
    const message =
      statusCode >= 500 && config.NODE_ENV === "production"
        ? "Internal Server Error"
        : errorMessage;

    if (statusCode >= 500) {
      request.log.error({ err: error }, "Request failed");
    } else {
      request.log.warn({ code, statusCode }, "Request rejected");
    }
    return reply.status(statusCode).send({ error: { code, message } });
  });

  return app;
}
