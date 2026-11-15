import { z } from "zod";

import { UserSummarySchema } from "./auth.js";
import {
  IsoDateTimeSchema,
  PaginationQuerySchema,
  UsernameSchema,
  UuidSchema,
  paginatedSchema,
} from "./common.js";

export const SeriesSchema = z.enum(["BO1", "BO3", "BO5"]);
export type Series = z.infer<typeof SeriesSchema>;
export const TournamentStatusSchema = z.enum(["open", "live", "finished"]);
export const TeamCountSchema = z.union([z.literal(4), z.literal(8), z.literal(16)]);
export type TournamentStatus = z.infer<typeof TournamentStatusSchema>;
export type TeamCount = z.infer<typeof TeamCountSchema>;

export const TeamSchema = z.object({
  id: UuidSchema,
  name: z.string().min(1),
  logo: z.string(),
});
export type Team = z.infer<typeof TeamSchema>;

export const BracketSlotSchema = z.object({
  team: TeamSchema.nullable(),
  score: z.number().int().min(0).nullable(),
  bye: z.boolean(),
});
export type BracketSlot = z.infer<typeof BracketSlotSchema>;

export const BracketMatchSchema = z.object({
  id: UuidSchema,
  label: z.string().min(1),
  time: z.string().min(1),
  slots: z.tuple([BracketSlotSchema, BracketSlotSchema]),
});
export type BracketMatch = z.infer<typeof BracketMatchSchema>;

export const BracketRoundSchema = z.object({
  name: z.string().min(1),
  matches: z.array(BracketMatchSchema),
});
export type BracketRound = z.infer<typeof BracketRoundSchema>;

export const ScheduledMatchSchema = z.object({
  id: UuidSchema,
  stage: z.string().min(1),
  time: z.string().min(1),
  home: TeamSchema,
  away: TeamSchema,
  score: z.tuple([z.number().int().min(0), z.number().int().min(0)]).optional(),
});
export type ScheduledMatch = z.infer<typeof ScheduledMatchSchema>;

export const TournamentSummarySchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(1),
  titleIcon: z.enum(["laurel", "trophy", "flag"]),
  cover: z.string().min(1),
  status: TournamentStatusSchema,
  format: z.string().min(1),
  organizer: z.string().min(1),
  description: z.string(),
  teamCount: TeamCountSchema,
  registeredTeams: z.number().int().min(0).optional(),
  registrationDeadline: IsoDateTimeSchema.optional(),
  drawDate: IsoDateTimeSchema.optional(),
  dateStart: IsoDateTimeSchema,
  dateEnd: IsoDateTimeSchema,
  createdAt: IsoDateTimeSchema,
  timeLabel: z.string().min(1),
  dateRange: z.string().min(1),
});
export type TournamentSummary = z.infer<typeof TournamentSummarySchema>;

export const RegistrationSchema = z.object({
  id: UuidSchema,
  teamName: z.string().min(1),
  members: z.array(UserSummarySchema).length(5),
  subs: z.array(UserSummarySchema).max(2),
  status: z.enum(["pending", "approved", "rejected", "withdrawn"]),
  rejectReason: z.string().nullable(),
  createdAt: IsoDateTimeSchema,
});
export type Registration = z.infer<typeof RegistrationSchema>;

export const TournamentDetailSchema = TournamentSummarySchema.extend({
  title: z.string().min(1),
  titleAccent: z.string().optional(),
  intro: z.array(z.string()),
  mode: z.string().min(1),
  category: z.string().min(1),
  formatLabel: z.string().min(1),
  series: SeriesSchema,
  heroImage: z.string().min(1),
  rules: z.array(z.string()),
  prizes: z.array(z.object({ place: z.string().min(1), reward: z.string().min(1) })),
  teamList: z.array(TeamSchema),
  bracket: z.array(BracketRoundSchema),
  upcoming: z.array(ScheduledMatchSchema),
  results: z.array(ScheduledMatchSchema),
  champion: TeamSchema.nullable(),
  myRole: z.enum(["organizer", "captain", "member"]).nullable(),
  myRegistration: RegistrationSchema.nullable(),
});
export type TournamentDetail = z.infer<typeof TournamentDetailSchema>;

export const TournamentsQuerySchema = PaginationQuerySchema.extend({
  status: TournamentStatusSchema.optional(),
  q: z.string().optional(),
  sort: z.enum(["createdAt", "deadline"]).optional(),
});
export type TournamentsQuery = z.infer<typeof TournamentsQuerySchema>;

export const TournamentsResponseSchema = paginatedSchema(TournamentSummarySchema);
export type TournamentsResponse = z.infer<typeof TournamentsResponseSchema>;

const TournamentWriteFieldsSchema = z.object({
  name: z.string().trim().min(1),
  titleAccent: z.string().trim().min(1).optional(),
  description: z.string(),
  intro: z.array(z.string()),
  teamCount: TeamCountSchema,
  series: SeriesSchema,
  registrationDeadline: IsoDateTimeSchema,
  drawDate: IsoDateTimeSchema,
  dateStart: IsoDateTimeSchema,
  dateEnd: IsoDateTimeSchema,
  rules: z.array(z.string()),
  prizes: z.array(z.object({ place: z.string().min(1), reward: z.string().min(1) })),
  cover: z.enum(["tour-1", "tour-2", "tour-3"]),
});

function validateDateOrder(
  value: {
    registrationDeadline?: string | undefined;
    drawDate?: string | undefined;
    dateStart?: string | undefined;
    dateEnd?: string | undefined;
  },
  context: z.RefinementCtx,
): void {
  const ordered = [
    ["registrationDeadline", value.registrationDeadline],
    ["drawDate", value.drawDate],
    ["dateStart", value.dateStart],
    ["dateEnd", value.dateEnd],
  ] as const;
  for (let earlierIndex = 0; earlierIndex < ordered.length; earlierIndex += 1) {
    for (let laterIndex = earlierIndex + 1; laterIndex < ordered.length; laterIndex += 1) {
      const earlier = ordered[earlierIndex]!;
      const later = ordered[laterIndex]!;
      if (
        earlier[1] !== undefined &&
        later[1] !== undefined &&
        Date.parse(earlier[1]) > Date.parse(later[1])
      ) {
        context.addIssue({
          code: "custom",
          path: [later[0]],
          message: "Thứ tự ngày phải là hạn đăng ký ≤ bốc thăm ≤ bắt đầu ≤ kết thúc",
        });
      }
    }
  }
}

export const CreateTournamentBodySchema = TournamentWriteFieldsSchema.superRefine(
  validateDateOrder,
);
export type CreateTournamentBody = z.infer<typeof CreateTournamentBodySchema>;

export const UpdateTournamentBodySchema = TournamentWriteFieldsSchema.partial()
  .refine((body) => Object.keys(body).length > 0, "Cần ít nhất một trường để cập nhật")
  .superRefine(validateDateOrder);
export type UpdateTournamentBody = z.infer<typeof UpdateTournamentBodySchema>;

export const CreateRegistrationBodySchema = z
  .object({
    teamName: z.string().trim().min(1),
    members: z.array(UsernameSchema).length(5),
    subs: z.array(UsernameSchema).max(2).optional(),
  })
  .superRefine((body, context) => {
    const usernames = [...body.members, ...(body.subs ?? [])];
    if (new Set(usernames).size !== usernames.length) {
      context.addIssue({
        code: "custom",
        path: ["members"],
        message: "Mỗi thành viên chỉ được xuất hiện một lần",
      });
    }
  });
export type CreateRegistrationBody = z.infer<typeof CreateRegistrationBodySchema>;

export const RejectRegistrationBodySchema = z.object({ reason: z.string().optional() });
export type RejectRegistrationBody = z.infer<typeof RejectRegistrationBodySchema>;

export const ScoreMatchBodySchema = z
  .object({
    scoreA: z.number().int().min(0),
    scoreB: z.number().int().min(0),
  });
export type ScoreMatchBody = z.infer<typeof ScoreMatchBodySchema>;

export const ScheduleMatchBodySchema = z.object({ scheduledAt: IsoDateTimeSchema });
export type ScheduleMatchBody = z.infer<typeof ScheduleMatchBodySchema>;

export const RegistrationsResponseSchema = z.array(RegistrationSchema);
export type RegistrationsResponse = z.infer<typeof RegistrationsResponseSchema>;

export const RegistrationResponseSchema = RegistrationSchema;
export type RegistrationResponse = Registration;
export const TournamentMutationResponseSchema = TournamentDetailSchema;
export type TournamentMutationResponse = TournamentDetail;
export const DeleteRegistrationResponseSchema = z.undefined();
export type DeleteRegistrationResponse = z.infer<typeof DeleteRegistrationResponseSchema>;

export function isValidSeriesScore(series: Series, scoreA: number, scoreB: number): boolean {
  if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB) || scoreA < 0 || scoreB < 0) {
    return false;
  }
  const winsNeeded: Record<Series, number> = { BO1: 1, BO3: 2, BO5: 3 };
  const target = winsNeeded[series];
  return (
    (scoreA === target && scoreB < target) ||
    (scoreB === target && scoreA < target)
  );
}

export const SeriesScoreBodySchema = z
  .object({
    series: SeriesSchema,
    scoreA: z.number().int().min(0),
    scoreB: z.number().int().min(0),
  })
  .refine((score) => isValidSeriesScore(score.series, score.scoreA, score.scoreB), {
    message: "Tỉ số không hợp lệ với thể thức BO",
  });
export type SeriesScoreBody = z.infer<typeof SeriesScoreBodySchema>;
