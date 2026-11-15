import {
  TournamentsQuerySchema,
  type TournamentDetail,
  type TournamentsResponse,
} from "@customaov/contracts";
import type { FastifyInstance } from "fastify";

import type { AuthDeps } from "../auth/plugin.js";
import {
  getTournamentBySlug,
  listTournaments,
} from "../services/tournaments.js";

export function registerTournamentRoutes(
  app: FastifyInstance,
  deps: AuthDeps,
): void {
  const { db } = deps;

  app.get("/api/tournaments", async (request): Promise<TournamentsResponse> => {
    const query = TournamentsQuerySchema.parse(request.query);
    return listTournaments(db, query);
  });

  app.get<{ Params: { slug: string } }>(
    "/api/tournaments/:slug",
    async (request, reply): Promise<TournamentDetail> => {
      const detail = await getTournamentBySlug(
        db,
        request.params.slug,
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
}
