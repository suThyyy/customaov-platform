import {
  UpdateMeBodySchema,
  type UpdateMeResponse,
  type UserProfile,
} from "@customaov/contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { AuthDeps } from "../auth/plugin.js";
import {
  getUserProfileByUsername,
  HttpError,
  updateMyProfile,
} from "../services/users.js";

export function registerUserRoutes(app: FastifyInstance, deps: AuthDeps): void {
  const { db } = deps;

  const writeCheck = app.createRateLimit({
    max: 60,
    timeWindow: 60_000,
    keyGenerator: (r: FastifyRequest) =>
      r.user ? `user-write:${r.user.id}` : `user-write:${r.ip}`,
  });

  const writeLimit = async (request: FastifyRequest, reply: FastifyReply) => {
    const res = await writeCheck(request);
    if (!res.isAllowed && res.isExceeded) {
      const seconds = Math.ceil(res.ttl / 1000);
      reply.header("retry-after", seconds);
      throw new HttpError(
        429,
        "RATE_LIMITED",
        `Bạn thao tác quá nhanh, thử lại sau ${seconds} giây`,
      );
    }
  };

  app.get<{ Params: { username: string } }>(
    "/api/users/:username",
    async (request): Promise<UserProfile> => {
      return getUserProfileByUsername(db, request.params.username);
    },
  );

  app.patch(
    "/api/users/me",
    { preHandler: writeLimit },
    async (request): Promise<UpdateMeResponse> => {
      if (!request.user) {
        throw new HttpError(
          401,
          "UNAUTHENTICATED",
          "Vui lòng đăng nhập để cập nhật hồ sơ",
        );
      }

      const body = UpdateMeBodySchema.parse(request.body);
      const user = await updateMyProfile(db, request.user.id, body);
      return { user };
    },
  );
}
