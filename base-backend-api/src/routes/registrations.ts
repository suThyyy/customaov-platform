import {
  CreateRegistrationBodySchema,
  RejectRegistrationBodySchema,
  UuidSchema,
  type RegistrationResponse,
  type RegistrationsResponse,
} from "@customaov/contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import type { AuthDeps } from "../auth/plugin.js";
import {
  RegistrationServiceError,
  approveRegistration,
  createRegistration,
  listRegistrations,
  rejectRegistration,
  withdrawRegistration,
} from "../services/registrations.js";

const SlugParamsSchema = z.object({ slug: z.string().min(1) });
const RegistrationParamsSchema = SlugParamsSchema.extend({ id: UuidSchema });

function requireAuth(
  request: FastifyRequest,
  _reply: FastifyReply,
  done: (err?: Error) => void,
): void {
  if (!request.user) {
    done(new RegistrationServiceError(401, "UNAUTHENTICATED", "Vui lòng đăng nhập"));
    return;
  }
  done();
}

/** Đăng ký đội vào giải (API.md mục 5, 9.2). CSRF do auth plugin kiểm cho mọi request ghi. */
export function registerRegistrationRoutes(app: FastifyInstance, deps: AuthDeps): void {
  const { db } = deps;

  app.post(
    "/api/tournaments/:slug/registrations",
    { preHandler: requireAuth },
    async (request, reply): Promise<RegistrationResponse> => {
      const { slug } = SlugParamsSchema.parse(request.params);
      const body = CreateRegistrationBodySchema.parse(request.body ?? {});
      const registration = await createRegistration(db, slug, body, request.user!, deps.now());
      reply.status(201);
      return registration;
    },
  );

  app.get(
    "/api/tournaments/:slug/registrations",
    { preHandler: requireAuth },
    async (request): Promise<RegistrationsResponse> => {
      const { slug } = SlugParamsSchema.parse(request.params);
      return listRegistrations(db, slug, request.user!.id);
    },
  );

  app.post(
    "/api/tournaments/:slug/registrations/:id/approve",
    { preHandler: requireAuth },
    async (request): Promise<RegistrationResponse> => {
      const { slug, id } = RegistrationParamsSchema.parse(request.params);
      return approveRegistration(db, slug, id, request.user!.id, deps.now());
    },
  );

  app.post(
    "/api/tournaments/:slug/registrations/:id/reject",
    { preHandler: requireAuth },
    async (request): Promise<RegistrationResponse> => {
      const { slug, id } = RegistrationParamsSchema.parse(request.params);
      const body = RejectRegistrationBodySchema.parse(request.body ?? {});
      return rejectRegistration(db, slug, id, body, request.user!.id, deps.now());
    },
  );

  app.delete(
    "/api/tournaments/:slug/registrations/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { slug, id } = RegistrationParamsSchema.parse(request.params);
      await withdrawRegistration(db, slug, id, request.user!.id, deps.now());
      return reply.status(204).send();
    },
  );
}
