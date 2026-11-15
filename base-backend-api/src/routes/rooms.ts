import {
  CreateRoomBodySchema,
  JoinRoomBodySchema,
  RoomCodeSchema,
  RoomDetailQuerySchema,
  RoomsQuerySchema,
  UpdateRoomMeBodySchema,
  type RoomDetail,
  type RoomDetailResponse,
  type RoomsResponse,
} from "@customaov/contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import type { AuthDeps } from "../auth/plugin.js";
import {
  RoomServiceError,
  createRoom,
  getRoomDetail,
  joinRoom,
  leaveRoom,
  listRooms,
  updateRoomMe,
} from "../services/rooms.js";

const RoomCodeParamsSchema = z.object({ code: RoomCodeSchema });

function requireAuth(
  request: FastifyRequest,
  _reply: FastifyReply,
  done: (err?: Error) => void,
): void {
  if (!request.user) {
    done(new RoomServiceError(401, "UNAUTHENTICATED", "Vui lòng đăng nhập"));
    return;
  }
  done();
}

export function registerRoomRoutes(app: FastifyInstance, deps: AuthDeps): void {
  const { db } = deps;

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
        throw new RoomServiceError(
          429,
          "RATE_LIMITED",
          `Bạn thao tác quá nhanh, thử lại sau ${seconds} giây`,
        );
      }
    };
  };

  const joinLimit = rateLimited(10, 60_000, (r) => `room-join:${r.user!.id}`);

  app.get("/api/rooms", async (request): Promise<RoomsResponse> => {
    const query = RoomsQuerySchema.parse(request.query);
    return listRooms(db, query, request.user?.id ?? null);
  });

  app.post(
    "/api/rooms",
    { preHandler: requireAuth },
    async (request, reply): Promise<RoomDetail> => {
      const parsed = CreateRoomBodySchema.safeParse(request.body);
      if (!parsed.success) {
        if (parsed.error.issues.some((i) => i.path.join(".") === "config.format")) {
          throw new RoomServiceError(
            400,
            "VALIDATION",
            "Sắp có: MVP chỉ hỗ trợ thể thức 5v5",
          );
        }
        throw parsed.error;
      }
      const room = await createRoom(db, parsed.data, request.user!, deps.now());
      reply.status(201);
      return room;
    },
  );

  app.get("/api/rooms/:code", async (request): Promise<RoomDetailResponse> => {
    const { code } = RoomCodeParamsSchema.parse(request.params);
    const query = RoomDetailQuerySchema.parse(request.query);
    return getRoomDetail(db, code, request.user?.id ?? null, query.key);
  });

  app.post(
    "/api/rooms/:code/join",
    { preHandler: [requireAuth, joinLimit] },
    async (request): Promise<RoomDetail> => {
      const { code } = RoomCodeParamsSchema.parse(request.params);
      const body = JoinRoomBodySchema.parse(request.body);
      return joinRoom(db, code, body, request.user!, deps.now());
    },
  );

  app.post(
    "/api/rooms/:code/leave",
    { preHandler: requireAuth },
    async (request): Promise<RoomDetail> => {
      const { code } = RoomCodeParamsSchema.parse(request.params);
      return leaveRoom(db, code, request.user!, deps.now());
    },
  );

  app.patch(
    "/api/rooms/:code/me",
    { preHandler: requireAuth },
    async (request): Promise<RoomDetail> => {
      const { code } = RoomCodeParamsSchema.parse(request.params);
      const body = UpdateRoomMeBodySchema.parse(request.body);
      return updateRoomMe(db, code, body, request.user!);
    },
  );
}
