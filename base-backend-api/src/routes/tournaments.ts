import {
  CreateTournamentBodySchema,
  TournamentSummarySchema,
  TournamentsQuerySchema,
  UpdateTournamentBodySchema,
  type TournamentDetail,
  type TournamentsResponse,
} from "@customaov/contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import type { AuthDeps } from "../auth/plugin.js";
import {
  TournamentServiceError,
  createTournament,
  getTournamentBySlug,
  listTournaments,
  updateTournament,
} from "../services/tournaments.js";

const SlugParamsSchema = z.object({
  slug: TournamentSummarySchema.shape.slug.pipe(z.string().max(90)),
});

function requireAuth(
  request: FastifyRequest,
  _reply: FastifyReply,
  done: (err?: Error) => void,
): void {
  if (!request.user) {
    done(new TournamentServiceError(401, "UNAUTHENTICATED", "Vui lòng đăng nhập"));
    return;
  }
  done();
}

export function registerTournamentRoutes(
  app: FastifyInstance,
  deps: AuthDeps,
): void {
  const { db } = deps;

  const checkCreateLimit = app.createRateLimit({
    max: 10,
    timeWindow: 60 * 60_000,
    keyGenerator: (r) => `tournament-create:${r.user?.id ?? r.ip}`,
  });
  const createLimit = async (request: FastifyRequest, reply: FastifyReply) => {
    const res = await checkCreateLimit(request);
    if (!res.isAllowed && res.isExceeded) {
      const seconds = Math.ceil(res.ttl / 1000);
      reply.header("retry-after", seconds);
      throw new TournamentServiceError(
        429,
        "RATE_LIMITED",
        `Bạn tạo giải quá nhanh, thử lại sau ${seconds} giây`,
      );
    }
  };

  app.get("/api/tournaments", async (request): Promise<TournamentsResponse> => {
    const query = TournamentsQuerySchema.parse(request.query);
    return listTournaments(db, query);
  });

  app.get(
    "/api/tournaments/:slug",
    async (request, reply): Promise<TournamentDetail> => {
      const { slug } = SlugParamsSchema.parse(request.params);
      const detail = await getTournamentBySlug(
        db,
        slug,
        request.user?.id ?? null,
      );
      if (!detail) {
        return reply.status(404).send({
          error: {
            code: "NOT_FOUND",
            message: "Không tìm thấy giải đấu",
          },
        });
      }
      return detail;
    },
  );

  app.post(
    "/api/tournaments",
    { preHandler: [requireAuth, createLimit] },
    async (request, reply): Promise<TournamentDetail> => {
      const body = CreateTournamentBodySchema.parse(request.body);
      const detail = await createTournament(db, body, request.user!, deps.now());
      reply.status(201);
      return detail;
    },
  );

  app.patch(
    "/api/tournaments/:slug",
    { preHandler: requireAuth },
    async (request): Promise<TournamentDetail> => {
      const { slug } = SlugParamsSchema.parse(request.params);
      const body = UpdateTournamentBodySchema.parse(request.body);
      return updateTournament(db, slug, body, request.user!);
    },
  );
}
