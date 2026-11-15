import {
  ScheduleMatchBodySchema,
  ScoreMatchBodySchema,
  UuidSchema,
  type TournamentMutationResponse,
} from "@customaov/contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import type { AuthDeps } from "../auth/plugin.js";
import {
  TournamentBracketError,
  closeRegistration,
  drawBracket,
  scheduleMatch,
  scoreMatch,
} from "../services/tournament-bracket.js";
import { getTournamentBySlug } from "../services/tournaments.js";

const SlugParamsSchema = z.object({ slug: z.string().min(1) });
const MatchParamsSchema = SlugParamsSchema.extend({ matchId: UuidSchema });

function requireAuth(
  request: FastifyRequest,
  _reply: FastifyReply,
  done: (err?: Error) => void,
): void {
  if (!request.user) {
    done(new TournamentBracketError(401, "UNAUTHENTICATED", "Vui lòng đăng nhập"));
    return;
  }
  done();
}

/** BTC: đóng đăng ký, bốc thăm, nhập tỉ số, xếp lịch (E5-T04b). */
export function registerTournamentBracketRoutes(
  app: FastifyInstance,
  deps: AuthDeps,
): void {
  const { db } = deps;

  async function detail(slug: string, userId: string): Promise<TournamentMutationResponse> {
    const result = await getTournamentBySlug(db, slug, userId);
    if (!result) {
      throw new TournamentBracketError(404, "NOT_FOUND", "Không tìm thấy giải đấu");
    }
    return result;
  }

  app.post(
    "/api/tournaments/:slug/close-registration",
    { preHandler: requireAuth },
    async (request): Promise<TournamentMutationResponse> => {
      const { slug } = SlugParamsSchema.parse(request.params);
      await closeRegistration(db, slug, request.user!.id, deps.now());
      return detail(slug, request.user!.id);
    },
  );

  app.post(
    "/api/tournaments/:slug/draw",
    { preHandler: requireAuth },
    async (request): Promise<TournamentMutationResponse> => {
      const { slug } = SlugParamsSchema.parse(request.params);
      await drawBracket(db, slug, request.user!.id);
      return detail(slug, request.user!.id);
    },
  );

  app.post(
    "/api/tournaments/:slug/matches/:matchId/score",
    { preHandler: requireAuth },
    async (request): Promise<TournamentMutationResponse> => {
      const { slug, matchId } = MatchParamsSchema.parse(request.params);
      const body = ScoreMatchBodySchema.parse(request.body);
      await scoreMatch(db, slug, matchId, body, request.user!.id, deps.now());
      return detail(slug, request.user!.id);
    },
  );

  app.patch(
    "/api/tournaments/:slug/matches/:matchId",
    { preHandler: requireAuth },
    async (request): Promise<TournamentMutationResponse> => {
      const { slug, matchId } = MatchParamsSchema.parse(request.params);
      const body = ScheduleMatchBodySchema.parse(request.body);
      await scheduleMatch(db, slug, matchId, body, request.user!.id);
      return detail(slug, request.user!.id);
    },
  );
}
