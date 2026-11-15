import cookie from "@fastify/cookie";
import Fastify, {
  type FastifyInstance,
  type FastifyRequest,
} from "fastify";
import type { Writable } from "node:stream";

import { loadConfig, type AppConfig } from "./config.js";

const REDACT_PATHS = [
  "req.headers.cookie",
  "req.headers.authorization",
  'req.headers["x-csrf-token"]',
  'res.headers["set-cookie"]',
  "*.password",
  "*.token",
];

export interface BuildAppOptions {
  config?: AppConfig;
  logger?: boolean;
  loggerStream?: Writable;
}

export function buildApp(opts: BuildAppOptions = {}): FastifyInstance {
  const config = opts.config ?? loadConfig();
  const logger =
    opts.logger === false
      ? false
      : {
          level: config.LOG_LEVEL,
          serializers: {
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

  app.register(cookie);

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
      typeof errorRecord.code === "string"
        ? errorRecord.code
        : "INTERNAL_ERROR";
    const errorMessage =
      error instanceof Error ? error.message : "Internal Server Error";
    const message =
      statusCode >= 500 && config.NODE_ENV === "production"
        ? "Internal Server Error"
        : errorMessage;

    request.log.error({ err: error }, "Request failed");
    return reply.status(statusCode).send({ error: { code, message } });
  });

  return app;
}
