import { SearchQuerySchema, type SearchResponse } from "@customaov/contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { AuthDeps } from "../auth/plugin.js";
import { searchAll } from "../services/search.js";
import { HttpError } from "../services/users.js";

/** Giới hạn tần suất tìm kiếm: 30 lần/phút/IP. */
export const SEARCH_RATE_LIMIT = { max: 30, timeWindow: 60_000 } as const;

export function registerSearchRoutes(app: FastifyInstance, deps: AuthDeps): void {
  const { db } = deps;

  const searchCheck = app.createRateLimit({
    ...SEARCH_RATE_LIMIT,
    keyGenerator: (r: FastifyRequest) => `search-ip:${r.ip}`,
  });

  const searchLimit = async (request: FastifyRequest, reply: FastifyReply) => {
    const res = await searchCheck(request);
    if (!res.isAllowed && res.isExceeded) {
      const seconds = Math.ceil(res.ttl / 1000);
      reply.header("retry-after", seconds);
      throw new HttpError(
        429,
        "RATE_LIMITED",
        `Bạn tìm kiếm quá nhanh, thử lại sau ${seconds} giây`,
      );
    }
  };

  app.get(
    "/api/search",
    { preHandler: searchLimit },
    async (request): Promise<SearchResponse> => {
      const query = SearchQuerySchema.parse(request.query);
      return searchAll(db, query.q, request.user?.id ?? null);
    },
  );
}
