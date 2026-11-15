import { ActivitiesQuerySchema, type ActivitiesResponse } from "@customaov/contracts";
import type { FastifyInstance } from "fastify";

import type { AuthDeps } from "../auth/plugin.js";
import { listMyActivities } from "../services/activities.js";
import { HttpError } from "../services/users.js";

export function registerActivityRoutes(app: FastifyInstance, deps: AuthDeps): void {
  const { db } = deps;

  app.get("/api/activities", async (request): Promise<ActivitiesResponse> => {
    if (!request.user) {
      throw new HttpError(401, "UNAUTHENTICATED", "Vui lòng đăng nhập để xem hoạt động");
    }
    const query = ActivitiesQuerySchema.parse(request.query);
    return listMyActivities(db, request.user.id, query);
  });
}
