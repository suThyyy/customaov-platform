import { z } from "zod";

import { UserSummarySchema } from "./auth.js";
import {
  IsoDateTimeSchema,
  PaginationQuerySchema,
  UuidSchema,
  paginatedSchema,
} from "./common.js";
import { RoomSummarySchema } from "./rooms.js";
import { TournamentSummarySchema } from "./tournaments.js";

export const ActivitySchema = z.object({
  id: UuidSchema,
  kind: z.enum(["join", "register", "invite", "result"]),
  text: z.string().min(1),
  emphasis: z.string().optional(),
  at: IsoDateTimeSchema,
});
export type Activity = z.infer<typeof ActivitySchema>;

export const ActivitiesQuerySchema = PaginationQuerySchema;
export type ActivitiesQuery = z.infer<typeof ActivitiesQuerySchema>;

export const ActivitiesResponseSchema = paginatedSchema(ActivitySchema);
export type ActivitiesResponse = z.infer<typeof ActivitiesResponseSchema>;

export const SearchQuerySchema = z.object({ q: z.string().min(2) });
export type SearchQuery = z.infer<typeof SearchQuerySchema>;

export const SearchResponseSchema = z.object({
  rooms: z.array(RoomSummarySchema).max(5),
  tournaments: z.array(TournamentSummarySchema).max(5),
  users: z.array(UserSummarySchema).max(5),
});
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
