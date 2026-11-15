import { z } from "zod";

import { UsernameSchema, UuidSchema } from "./common.js";

export const UserSummarySchema = z.object({
  id: UuidSchema,
  username: UsernameSchema,
  displayName: z.string().min(1).max(24),
  avatarUrl: z.string().nullable(),
  level: z.number().int().min(1),
  crowned: z.boolean(),
});
export type UserSummary = z.infer<typeof UserSummarySchema>;

export const MeSchema = UserSummarySchema.extend({
  uid: z.string().regex(/^\d{6}$/),
});
export type Me = z.infer<typeof MeSchema>;

export const RegisterBodySchema = z.object({
  username: UsernameSchema,
  password: z.string().min(8).max(72),
  displayName: z.string().trim().min(1).max(24),
});
export type RegisterBody = z.infer<typeof RegisterBodySchema>;

export const LoginBodySchema = z.object({
  username: UsernameSchema,
  password: z.string().min(8).max(72),
});
export type LoginBody = z.infer<typeof LoginBodySchema>;

export const CsrfResponseSchema = z.object({ csrfToken: z.string().min(1) });
export type CsrfResponse = z.infer<typeof CsrfResponseSchema>;

export const AuthResponseSchema = z.object({ user: MeSchema });
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export const MeResponseSchema = z.object({
  user: MeSchema.nullable(),
  csrfToken: z.string().min(1),
});
export type MeResponse = z.infer<typeof MeResponseSchema>;

export const LogoutResponseSchema = z.undefined();
export type LogoutResponse = z.infer<typeof LogoutResponseSchema>;
