import {
  CreateMessageBodySchema,
  CreateRoomBodySchema,
  JoinRoomBodySchema,
  KickRoomMemberBodySchema,
  MessagesQuerySchema,
  MoveRoomMemberBodySchema,
  RoomCodeSchema,
  RoomDetailQuerySchema,
  RoomResultBodySchema,
  RoomsQuerySchema,
  SplitRoomBodySchema,
  UpdateRoomMeBodySchema,
  type ChatMessage,
  type RoomDetail,
  type RoomDetailResponse,
  type RoomsResponse,
} from "@customaov/contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import type { AuthDeps } from "../auth/plugin.js";
import {
  exportRoomTeams,
  getRoomMessages,
  kickRoomMember,
  moveRoomMember,
  postRoomMessage,
  randomRoomLanes,
  splitRoom,
  submitRoomResult,
} from "../services/room-host.js";
import {
  RoomServiceError,
  createRoom,
  getRoomDetail,
  joinRoom,
  leaveRoom,
  listRooms,
  updateRoomMe,
} from "../services/rooms.js";

export interface RoomRoutesDeps extends AuthDeps {
  onRoomChanged?: (code: string) => void;
  onChatMessage?: (code: string, message: ChatMessage) => void;
}

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

export function registerRoomRoutes(app: FastifyInstance, deps: RoomRoutesDeps): void {
  const { db } = deps;
  const onRoomChanged = deps.onRoomChanged ?? (() => {});
  const onChatMessage = deps.onChatMessage ?? (() => {});

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
  const chatLimit = rateLimited(10, 10_000, (r) => `room-chat:${r.user!.id}`);

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
      const room = await joinRoom(db, code, body, request.user!, deps.now());
      onRoomChanged(code);
      return room;
    },
  );

  app.post(
    "/api/rooms/:code/leave",
    { preHandler: requireAuth },
    async (request): Promise<RoomDetail> => {
      const { code } = RoomCodeParamsSchema.parse(request.params);
      const room = await leaveRoom(db, code, request.user!, deps.now());
      onRoomChanged(code);
      return room;
    },
  );

  app.patch(
    "/api/rooms/:code/me",
    { preHandler: requireAuth },
    async (request): Promise<RoomDetail> => {
      const { code } = RoomCodeParamsSchema.parse(request.params);
      const body = UpdateRoomMeBodySchema.parse(request.body);
      const room = await updateRoomMe(db, code, body, request.user!);
      onRoomChanged(code);
      return room;
    },
  );

  app.post(
    "/api/rooms/:code/split",
    { preHandler: requireAuth },
    async (request): Promise<RoomDetail> => {
      const { code } = RoomCodeParamsSchema.parse(request.params);
      const body = SplitRoomBodySchema.parse(request.body);
      const room = await splitRoom(db, code, body, request.user!, deps.now());
      onRoomChanged(code);
      return room;
    },
  );

  app.post(
    "/api/rooms/:code/move",
    { preHandler: requireAuth },
    async (request): Promise<RoomDetail> => {
      const { code } = RoomCodeParamsSchema.parse(request.params);
      const body = MoveRoomMemberBodySchema.parse(request.body);
      const room = await moveRoomMember(db, code, body, request.user!);
      onRoomChanged(code);
      return room;
    },
  );

  app.post(
    "/api/rooms/:code/kick",
    { preHandler: requireAuth },
    async (request): Promise<RoomDetail> => {
      const { code } = RoomCodeParamsSchema.parse(request.params);
      const body = KickRoomMemberBodySchema.parse(request.body);
      const room = await kickRoomMember(db, code, body, request.user!, deps.now());
      onRoomChanged(code);
      return room;
    },
  );

  app.post(
    "/api/rooms/:code/random-lanes",
    { preHandler: requireAuth },
    async (request): Promise<RoomDetail> => {
      const { code } = RoomCodeParamsSchema.parse(request.params);
      const room = await randomRoomLanes(db, code, request.user!);
      onRoomChanged(code);
      return room;
    },
  );

  app.post(
    "/api/rooms/:code/result",
    { preHandler: requireAuth },
    async (request): Promise<RoomDetail> => {
      const { code } = RoomCodeParamsSchema.parse(request.params);
      const body = RoomResultBodySchema.parse(request.body);
      const room = await submitRoomResult(db, code, body, request.user!, deps.now());
      onRoomChanged(code);
      return room;
    },
  );

  app.get(
    "/api/rooms/:code/export",
    { preHandler: requireAuth },
    async (request, reply): Promise<string> => {
      const { code } = RoomCodeParamsSchema.parse(request.params);
      const text = await exportRoomTeams(db, code, request.user!.id);
      return reply.type("text/plain; charset=utf-8").send(text);
    },
  );

  app.get(
    "/api/rooms/:code/messages",
    { preHandler: requireAuth },
    async (request): Promise<ChatMessage[]> => {
      const { code } = RoomCodeParamsSchema.parse(request.params);
      const query = MessagesQuerySchema.parse(request.query);
      return getRoomMessages(db, code, query, request.user!.id);
    },
  );

  app.post(
    "/api/rooms/:code/messages",
    { preHandler: [requireAuth, chatLimit] },
    async (request, reply): Promise<ChatMessage> => {
      const { code } = RoomCodeParamsSchema.parse(request.params);
      const body = CreateMessageBodySchema.parse(request.body);
      const message = await postRoomMessage(db, code, body, request.user!, deps.now());
      onChatMessage(code, message);
      reply.status(201);
      return message;
    },
  );
}
