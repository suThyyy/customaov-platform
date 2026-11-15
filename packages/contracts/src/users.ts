import { z } from "zod";

import { MeSchema, UserSummarySchema } from "./auth.js";
import { IsoDateTimeSchema, UuidSchema } from "./common.js";

export const AchievementSchema = z.object({
  id: UuidSchema,
  title: z.string().min(1),
  description: z.string(),
  date: IsoDateTimeSchema,
  icon: z.enum(["trophy", "star", "swords", "users"]),
});
export type Achievement = z.infer<typeof AchievementSchema>;

export const RoomMatchSummarySchema = z.object({
  id: UuidSchema,
  roomCode: z.string().regex(/^AOV-\d{4,6}$/),
  roomTitle: z.string().min(1),
  winner: z.enum(["blue", "red"]),
  result: z.enum(["win", "loss"]),
  at: IsoDateTimeSchema,
});
export type RoomMatchSummary = z.infer<typeof RoomMatchSummarySchema>;

export const UserProfileSchema = z.object({
  user: UserSummarySchema,
  uid: z.string().regex(/^\d{6}$/),
  bio: z.string().max(280),
  bioExtra: z.string().max(280),
  roleBadge: z.string(),
  playerBadge: z.string(),
  stats: z.object({
    customMatches: z.number().int().min(0),
    wins: z.number().int().min(0),
    losses: z.number().int().min(0),
    winRate: z.number().min(0).max(100),
    tournamentsJoined: z.number().int().min(0),
    titles: z.number().int().min(0),
  }),
  achievements: z.array(AchievementSchema),
  history: z.array(RoomMatchSummarySchema),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

const HttpsUrlSchema = z
  .url()
  .max(300)
  .refine((value) => value.startsWith("https://"), "avatarUrl phải dùng HTTPS");

export const UpdateMeBodySchema = z
  .object({
    displayName: z.string().trim().min(1).max(24).optional(),
    bio: z.string().max(280).optional(),
    bioExtra: z.string().max(280).optional(),
    avatarUrl: HttpsUrlSchema.nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, "Cần ít nhất một trường để cập nhật");
export type UpdateMeBody = z.infer<typeof UpdateMeBodySchema>;

export const UpdateMeResponseSchema = z.object({ user: MeSchema });
export type UpdateMeResponse = z.infer<typeof UpdateMeResponseSchema>;
