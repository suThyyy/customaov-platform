import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { AppConfig } from "../config.js";
import type { RoomRealtimeHub } from "./hub.js";

export interface RealtimePluginOptions {
  config: AppConfig;
  hub: RoomRealtimeHub;
}

function validateOrigin(
  originHeader: string | string[] | undefined,
  allowedOrigins: ReadonlySet<string>,
  nodeEnv: AppConfig["NODE_ENV"],
): { ok: true } | { ok: false; message: string } {
  if (Array.isArray(originHeader)) {
    return { ok: false, message: "Origin không hợp lệ" };
  }
  const origin = typeof originHeader === "string" ? originHeader.trim() : "";
  if (!origin) {
    if (nodeEnv === "production") {
      return { ok: false, message: "Thiếu header Origin" };
    }
    return { ok: true };
  }
  if (!allowedOrigins.has(origin)) {
    return { ok: false, message: "Origin không được phép" };
  }
  return { ok: true };
}

export function registerRealtimePlugin(
  app: FastifyInstance,
  options: RealtimePluginOptions,
): void {
  const { config, hub } = options;
  const allowedOrigins = new Set(config.ALLOWED_ORIGINS);

  app.addHook("onClose", async () => {
    await hub.close();
  });

  app.register(async (instance) => {
    instance.get(
      "/api/ws",
      {
        websocket: true,
        preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
          const originCheck = validateOrigin(
            request.headers.origin,
            allowedOrigins,
            config.NODE_ENV,
          );
          if (!originCheck.ok) {
            return reply.status(403).send({
              error: {
                code: "FORBIDDEN",
                message: originCheck.message,
              },
            });
          }

          if (!request.user && !hub.canAcceptGuest(request.ip)) {
            return reply.status(429).send({
              error: {
                code: "RATE_LIMITED",
                message: "Quá nhiều kết nối WebSocket từ địa chỉ này",
              },
            });
          }
        },
      },
      (socket, request) => {
        hub.handleConnection(socket, {
          userId: request.user?.id ?? null,
          ip: request.ip,
        });
      },
    );
  });
}
