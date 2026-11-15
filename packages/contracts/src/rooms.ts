import { z } from "zod";

import { UserSummarySchema, type UserSummary } from "./auth.js";
import {
  ErrorCodeSchema,
  IsoDateTimeSchema,
  PaginationQuerySchema,
  UuidSchema,
  paginatedSchema,
} from "./common.js";

export const RoomCodeSchema = z.string().regex(/^AOV-\d{4,6}$/);
export const RoomModeSchema = z.enum(["normal", "tournament", "friendly", "other"]);
export const RoomStatusSchema = z.enum(["waiting", "live", "finished"]);
export const RoomVisibilitySchema = z.enum(["public", "private"]);
export const SideSchema = z.enum(["blue", "red"]);
export const LaneSchema = z.enum(["TOP", "JG", "MID", "AD", "SP"]);
export type RoomCode = z.infer<typeof RoomCodeSchema>;
export type RoomMode = z.infer<typeof RoomModeSchema>;
export type RoomStatus = z.infer<typeof RoomStatusSchema>;
export type RoomVisibility = z.infer<typeof RoomVisibilitySchema>;
export type Side = z.infer<typeof SideSchema>;
export type Lane = z.infer<typeof LaneSchema>;

export const RoomConfigSchema = z.object({
  format: z.literal("5v5"),
  pickMode: z.enum(["draft", "blind", "random"]),
  series: z.enum(["BO1", "BO3", "BO5"]),
  tools: z
    .array(z.enum(["balance", "lane", "champion", "mystery", "chat"]))
    .refine((tools) => new Set(tools).size === tools.length, "Công cụ không được trùng"),
  notes: z.string(),
});
export type RoomConfig = z.infer<typeof RoomConfigSchema>;

export const RoomMemberSchema = z.object({
  user: UserSummarySchema,
  lane: LaneSchema.nullable(),
  ready: z.boolean(),
  captain: z.boolean(),
  tier: z.number().int().min(1).max(5).nullable(),
});
export type RoomMember = z.infer<typeof RoomMemberSchema>;

export const RoomSummarySchema = z
  .object({
    code: RoomCodeSchema,
    title: z.string().min(1),
    highlight: z.string().nullable(),
    thumbnail: z.string().min(1),
    host: UserSummarySchema,
    mode: RoomModeSchema,
    modeLabel: z.string().min(1),
    visibility: RoomVisibilitySchema,
    playerCount: z.number().int().min(0),
    capacity: z.number().int().min(1),
    status: RoomStatusSchema,
    isMember: z.boolean(),
  })
  .refine((room) => room.playerCount <= room.capacity, {
    message: "playerCount không được lớn hơn capacity",
    path: ["playerCount"],
  });
export type RoomSummary = z.infer<typeof RoomSummarySchema>;

export const LastSplitSchema = z.object({
  mode: z.enum(["random", "tier"]),
  balanceLevel: z.enum(["50-50", "60-40", "70-30"]).nullable(),
  warning: z.boolean(),
  at: IsoDateTimeSchema,
});
export type LastSplit = z.infer<typeof LastSplitSchema>;

export const RoomRestrictedSchema = RoomSummarySchema.safeExtend({
  restricted: z.literal(true),
});
export type RoomRestricted = z.infer<typeof RoomRestrictedSchema>;

export const RoomDetailSchema = RoomSummarySchema.safeExtend({
  config: RoomConfigSchema,
  teams: z.object({
    blue: z.array(RoomMemberSchema).max(5),
    red: z.array(RoomMemberSchema).max(5),
  }),
  spectators: z.array(UserSummarySchema),
  myRole: z.enum(["host", "player", "spectator"]).nullable(),
  lastSplit: LastSplitSchema.nullable(),
  result: z
    .object({
      winner: SideSchema,
      at: IsoDateTimeSchema,
    })
    .nullable(),
  shareUrl: z.string().min(1).optional(),
});
export type RoomDetail = z.infer<typeof RoomDetailSchema>;

export const RoomDetailResponseSchema = z.union([
  RoomDetailSchema.safeExtend({ restricted: z.literal(false) }),
  RoomRestrictedSchema,
]);
export type RoomDetailResponse = z.infer<typeof RoomDetailResponseSchema>;

export const RoomsQuerySchema = PaginationQuerySchema.extend({
  q: z.string().optional(),
  mode: RoomModeSchema.optional(),
  status: RoomStatusSchema.optional(),
  mine: z.literal("1").optional(),
});
export type RoomsQuery = z.infer<typeof RoomsQuerySchema>;

export const RoomsResponseSchema = paginatedSchema(RoomSummarySchema);
export type RoomsResponse = z.infer<typeof RoomsResponseSchema>;

export const CreateRoomBodySchema = z.object({
  title: z.string().trim().min(1),
  highlight: z.string().trim().min(1).optional(),
  mode: RoomModeSchema,
  visibility: RoomVisibilitySchema,
  config: RoomConfigSchema,
});
export type CreateRoomBody = z.infer<typeof CreateRoomBodySchema>;

export const RoomDetailQuerySchema = z.object({ key: z.string().min(1).optional() });
export type RoomDetailQuery = z.infer<typeof RoomDetailQuerySchema>;

export const JoinRoomBodySchema = z.object({
  as: z.enum(["player", "spectator"]),
  key: z.string().min(1).optional(),
});
export type JoinRoomBody = z.infer<typeof JoinRoomBodySchema>;

export const UpdateRoomMeBodySchema = z
  .object({
    lane: LaneSchema.nullable().optional(),
    ready: z.boolean().optional(),
    tier: z.number().int().min(1).max(5).nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, "Cần ít nhất một trường để cập nhật");
export type UpdateRoomMeBody = z.infer<typeof UpdateRoomMeBodySchema>;

export const SplitRoomBodySchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("random") }),
  z.object({
    mode: z.literal("tier"),
    balanceLevel: z.enum(["50-50", "60-40", "70-30"]).optional(),
  }),
]);
export type SplitRoomBody = z.infer<typeof SplitRoomBodySchema>;

export const MoveRoomMemberBodySchema = z.object({
  userId: UuidSchema,
  to: SideSchema,
  targetUserId: UuidSchema.optional(),
});
export type MoveRoomMemberBody = z.infer<typeof MoveRoomMemberBodySchema>;

export const KickRoomMemberBodySchema = z.object({ userId: UuidSchema });
export type KickRoomMemberBody = z.infer<typeof KickRoomMemberBodySchema>;

export const RoomResultBodySchema = z.object({ winner: SideSchema });
export type RoomResultBody = z.infer<typeof RoomResultBodySchema>;

export const MessagesQuerySchema = z.object({ before: UuidSchema.optional() });
export type MessagesQuery = z.infer<typeof MessagesQuerySchema>;

export const CreateMessageBodySchema = z.object({ text: z.string().trim().min(1).max(500) });
export type CreateMessageBody = z.infer<typeof CreateMessageBodySchema>;

export const ChatMessageSchema = z.object({
  id: UuidSchema,
  author: UserSummarySchema.nullable(),
  text: z.string().min(1).max(500),
  system: z.boolean(),
  at: IsoDateTimeSchema,
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const MessagesResponseSchema = z.array(ChatMessageSchema).max(50);
export type MessagesResponse = z.infer<typeof MessagesResponseSchema>;

export const ExportTeamsResponseSchema = z.string();
export type ExportTeamsResponse = z.infer<typeof ExportTeamsResponseSchema>;

// Mutating room endpoints return the canonical room snapshot after the write.
export const RoomMutationResponseSchema = RoomDetailSchema;
export type RoomMutationResponse = RoomDetail;

export const WsClientMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("subscribe"), room: RoomCodeSchema, key: z.string().min(1).optional() }),
  z.object({ type: z.literal("unsubscribe"), room: RoomCodeSchema }),
]);
export type WsClientMessage = z.infer<typeof WsClientMessageSchema>;

export const WsServerMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("room.updated"), room: RoomDetailSchema }),
  z.object({
    type: z.literal("chat.message"),
    room: RoomCodeSchema,
    message: ChatMessageSchema,
  }),
  z.object({ type: z.literal("room.kicked"), room: RoomCodeSchema }),
  z.object({ type: z.literal("error"), code: ErrorCodeSchema, room: RoomCodeSchema }),
]);
export type WsServerMessage = z.infer<typeof WsServerMessageSchema>;

export type RoomRole = "host" | "player" | "spectator";
export type RoomPermission = "split" | "random" | "move" | "kick" | "chat" | "export";

export const ROOM_PERMISSIONS: Array<{
  id: RoomPermission;
  label: string;
  roles: RoomRole[];
}> = [
  { id: "split", label: "Chia đội / chia lại", roles: ["host"] },
  { id: "random", label: "Random lane, tướng, hộp bí ẩn", roles: ["host"] },
  { id: "move", label: "Đổi chỗ người chơi giữa hai đội", roles: ["host"] },
  { id: "kick", label: "Mời người chơi ra khỏi phòng", roles: ["host"] },
  { id: "chat", label: "Chat trong phòng", roles: ["host", "player"] },
  { id: "export", label: "Xuất kết quả chia đội", roles: ["host", "player"] },
];

export const can = (role: RoomRole, permission: RoomPermission): boolean =>
  ROOM_PERMISSIONS.some((item) => item.id === permission && item.roles.includes(role));

export interface Teams {
  blue: RoomMember[];
  red: RoomMember[];
}

export const otherSide = (side: Side): Side => (side === "blue" ? "red" : "blue");

export function sideOf(teams: Teams, playerId: string): Side | undefined {
  if (teams.blue.some((member) => member.user.id === playerId)) return "blue";
  if (teams.red.some((member) => member.user.id === playerId)) return "red";
  return undefined;
}

export type MoveResult =
  | { ok: true; teams: Teams; swapped?: string }
  | { ok: false; message: string };

export function moveMember(
  teams: Teams,
  playerId: string,
  to: Side,
  perSide: number,
  targetId?: string,
): MoveResult {
  const from = sideOf(teams, playerId);
  if (!from) return { ok: false, message: "Người chơi không còn trong phòng." };
  if (from === to) return { ok: true, teams };
  const mover = teams[from].find((member) => member.user.id === playerId)!;
  const target = targetId
    ? teams[to].find((member) => member.user.id === targetId)
    : undefined;
  if (target) {
    return {
      ok: true,
      swapped: target.user.displayName,
      teams: {
        ...teams,
        [from]: teams[from].map((member) =>
          member.user.id === playerId ? target : member,
        ),
        [to]: teams[to].map((member) =>
          member.user.id === target.user.id ? mover : member,
        ),
      } as Teams,
    };
  }
  if (teams[to].length >= perSide) {
    return {
      ok: false,
      message: "Đội kia đã đủ người. Thả lên một người chơi để đổi chỗ.",
    };
  }
  return {
    ok: true,
    teams: {
      ...teams,
      [from]: teams[from].filter((member) => member.user.id !== playerId),
      [to]: [...teams[to], mover],
    } as Teams,
  };
}

export const removeMember = (teams: Teams, playerId: string): Teams => ({
  blue: teams.blue.filter((member) => member.user.id !== playerId),
  red: teams.red.filter((member) => member.user.id !== playerId),
});

const LANE_ORDER: Array<Lane | null> = ["TOP", "JG", "MID", "AD", "SP", null];

export function formatTeamsText(
  room: Pick<RoomSummary, "code" | "title" | "highlight">,
  teams: Teams,
): string {
  const line = (member: RoomMember) =>
    `- ${member.user.displayName} (${member.lane ?? "Chưa chọn"})${member.captain ? " ★" : ""}`;
  const sorted = (list: RoomMember[]) =>
    [...list].sort(
      (a, b) => LANE_ORDER.indexOf(a.lane) - LANE_ORDER.indexOf(b.lane),
    );
  return [
    `Phòng #${room.code} – ${room.title}${room.highlight ? ` – ${room.highlight}` : ""}`,
    "",
    `Team Xanh (${teams.blue.length})`,
    ...sorted(teams.blue).map(line),
    "",
    `Team Đỏ (${teams.red.length})`,
    ...sorted(teams.red).map(line),
  ].join("\n");
}

export type RoomUser = UserSummary;
