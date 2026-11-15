import assert from "node:assert/strict";
import test from "node:test";
import type { ZodType } from "zod";

import * as contracts from "../src/index.js";
import type { RoomMember, Teams } from "../src/index.js";

const ID_1 = "00000000-0000-4000-8000-000000000001";
const ID_2 = "00000000-0000-4000-8000-000000000002";
const ID_3 = "00000000-0000-4000-8000-000000000003";
const AT = "2026-11-15T12:00:00+07:00";

const user = {
  id: ID_1,
  username: "suthy",
  displayName: "Sư Thầy",
  avatarUrl: null,
  level: 12,
  crowned: true,
};
const otherUser = {
  ...user,
  id: ID_2,
  username: "alpha",
  displayName: "Alpha",
  crowned: false,
};
const member = (value: typeof user, lane: RoomMember["lane"] = "TOP"): RoomMember => ({
  user: value,
  lane,
  ready: true,
  captain: value.id === ID_1,
  tier: 3,
});

const config = {
  format: "5v5" as const,
  pickMode: "draft" as const,
  series: "BO3" as const,
  tools: ["balance", "chat"] as const,
  notes: "Vui vẻ",
};
const roomSummary = {
  code: "AOV-1024",
  title: "Phòng cộng đồng",
  highlight: null,
  thumbnail: "/room.jpg",
  host: user,
  mode: "normal" as const,
  modeLabel: "5v5 · Custom",
  visibility: "public" as const,
  playerCount: 2,
  capacity: 10,
  status: "waiting" as const,
  isMember: true,
};
const roomDetail = {
  ...roomSummary,
  config: { ...config, tools: [...config.tools] },
  teams: { blue: [member(user)], red: [member(otherUser, "JG")] },
  spectators: [],
  myRole: "host" as const,
  lastSplit: null,
  result: null,
};
const chatMessage = {
  id: ID_3,
  author: user,
  text: "Xin chào",
  system: false,
  at: AT,
};

const team = { id: ID_1, name: "Ngũ Hổ", logo: "/team.png" };
const team2 = { id: ID_2, name: "Alpha", logo: "/alpha.png" };
const tournamentSummary = {
  slug: "ngu-kiet-cup",
  name: "Ngũ Kiệt Cup",
  titleIcon: "trophy" as const,
  cover: "/tour.jpg",
  status: "open" as const,
  format: "5v5 – Cộng đồng",
  organizer: "Ban tổ chức",
  description: "Giải cộng đồng",
  teamCount: 8 as const,
  registeredTeams: 2,
  registrationDeadline: AT,
  drawDate: "2026-11-16T12:00:00+07:00",
  dateStart: "2026-11-17T12:00:00+07:00",
  dateEnd: "2026-11-20T12:00:00+07:00",
  createdAt: AT,
  timeLabel: "Hạn đăng ký: 15/11",
  dateRange: "17/11 – 20/11",
};
const registration = {
  id: ID_3,
  teamName: "Ngũ Hổ",
  members: [
    user,
    otherUser,
    { ...user, id: "00000000-0000-4000-8000-000000000004", username: "user4" },
    { ...user, id: "00000000-0000-4000-8000-000000000005", username: "user5" },
    { ...user, id: "00000000-0000-4000-8000-000000000006", username: "user6" },
  ],
  subs: [],
  status: "pending" as const,
  rejectReason: null,
  createdAt: AT,
};
const tournamentDetail = {
  ...tournamentSummary,
  title: "Ngũ Kiệt",
  intro: ["Thi đấu hết mình"],
  mode: "5v5 • Custom",
  category: "Giải cộng đồng",
  formatLabel: "Loại trực tiếp (BO3)",
  series: "BO3" as const,
  heroImage: "/hero.jpg",
  rules: ["Tôn trọng đối thủ"],
  prizes: [{ place: "Vô địch", reward: "Cúp" }],
  teamList: [team, team2],
  bracket: [
    {
      name: "Chung kết (BO3)",
      matches: [
        {
          id: ID_3,
          label: "Chung kết",
          time: "20/11 19:00",
          slots: [
            { team, score: null, bye: false },
            { team: team2, score: null, bye: false },
          ],
        },
      ],
    },
  ],
  upcoming: [
    { id: ID_3, stage: "Chung kết", time: "20/11 19:00", home: team, away: team2 },
  ],
  results: [],
  champion: null,
  myRole: "captain" as const,
  myRegistration: registration,
};

interface SchemaCase {
  name: string;
  schema: ZodType;
  valid: unknown;
  invalid: unknown;
}

const schemaCases: SchemaCase[] = [
  { name: "ErrorCode", schema: contracts.ErrorCodeSchema, valid: "VALIDATION", invalid: "BAD" },
  {
    name: "ErrorBody",
    schema: contracts.ErrorBodySchema,
    valid: { error: { code: "NOT_FOUND", message: "Không tìm thấy" } },
    invalid: { error: { code: "BAD", message: "Lỗi" } },
  },
  { name: "IsoDateTime", schema: contracts.IsoDateTimeSchema, valid: AT, invalid: "15/11/2026" },
  { name: "Uuid", schema: contracts.UuidSchema, valid: ID_1, invalid: "user-1" },
  { name: "EmptyBody", schema: contracts.EmptyBodySchema, valid: undefined, invalid: {} },
  { name: "Username", schema: contracts.UsernameSchema, valid: "user_01", invalid: "User" },
  { name: "PaginationQuery", schema: contracts.PaginationQuerySchema, valid: {}, invalid: { page: 0 } },
  { name: "UserSummary", schema: contracts.UserSummarySchema, valid: user, invalid: { ...user, level: 0 } },
  { name: "Me", schema: contracts.MeSchema, valid: { ...user, uid: "102394" }, invalid: { ...user, uid: "123" } },
  {
    name: "RegisterBody",
    schema: contracts.RegisterBodySchema,
    valid: { username: "new_user", password: "password123", displayName: " Người mới " },
    invalid: { username: "NO", password: "short", displayName: "" },
  },
  {
    name: "LoginBody",
    schema: contracts.LoginBodySchema,
    valid: { username: "suthy", password: "password123" },
    invalid: { username: "suthy", password: "short" },
  },
  { name: "CsrfResponse", schema: contracts.CsrfResponseSchema, valid: { csrfToken: "token" }, invalid: { csrfToken: "" } },
  { name: "AuthResponse", schema: contracts.AuthResponseSchema, valid: { user: { ...user, uid: "102394" } }, invalid: { user } },
  { name: "MeResponse", schema: contracts.MeResponseSchema, valid: { user: null, csrfToken: "token" }, invalid: { user: null } },
  { name: "LogoutResponse", schema: contracts.LogoutResponseSchema, valid: undefined, invalid: null },
  {
    name: "Achievement",
    schema: contracts.AchievementSchema,
    valid: { id: ID_1, title: "Vô địch", description: "Cup", date: AT, icon: "trophy" },
    invalid: { id: ID_1, title: "", description: "Cup", date: AT, icon: "trophy" },
  },
  {
    name: "RoomMatchSummary",
    schema: contracts.RoomMatchSummarySchema,
    valid: { id: ID_1, roomCode: "AOV-1024", roomTitle: "Phòng", winner: "blue", result: "win", at: AT },
    invalid: { id: ID_1, roomCode: "1024", roomTitle: "Phòng", winner: "blue", result: "win", at: AT },
  },
  {
    name: "UserProfile",
    schema: contracts.UserProfileSchema,
    valid: { user, uid: "102394", bio: "", bioExtra: "", roleBadge: "Đấu sĩ", playerBadge: "VIP", stats: { customMatches: 10, wins: 6, losses: 4, winRate: 60, tournamentsJoined: 2, titles: 1 }, achievements: [], history: [] },
    invalid: { user, uid: "102394", bio: "", bioExtra: "", roleBadge: "", playerBadge: "", stats: { customMatches: -1, wins: 0, losses: 0, winRate: 0, tournamentsJoined: 0, titles: 0 }, achievements: [], history: [] },
  },
  { name: "UpdateMeBody", schema: contracts.UpdateMeBodySchema, valid: { avatarUrl: "https://example.com/a.png" }, invalid: {} },
  { name: "UpdateMeResponse", schema: contracts.UpdateMeResponseSchema, valid: { user: { ...user, uid: "102394" } }, invalid: { user } },
  { name: "RoomCode", schema: contracts.RoomCodeSchema, valid: "AOV-1024", invalid: "AOV-12" },
  { name: "RoomMode", schema: contracts.RoomModeSchema, valid: "normal", invalid: "rank" },
  { name: "RoomStatus", schema: contracts.RoomStatusSchema, valid: "waiting", invalid: "closed" },
  { name: "RoomVisibility", schema: contracts.RoomVisibilitySchema, valid: "public", invalid: "friends" },
  { name: "Side", schema: contracts.SideSchema, valid: "blue", invalid: "green" },
  { name: "Lane", schema: contracts.LaneSchema, valid: "TOP", invalid: "BOT" },
  { name: "RoomConfig", schema: contracts.RoomConfigSchema, valid: { ...config, tools: [...config.tools] }, invalid: { ...config, format: "3v3" } },
  { name: "RoomMember", schema: contracts.RoomMemberSchema, valid: member(user), invalid: { ...member(user), tier: 6 } },
  { name: "RoomSummary", schema: contracts.RoomSummarySchema, valid: roomSummary, invalid: { ...roomSummary, playerCount: 11 } },
  { name: "RoomRestricted", schema: contracts.RoomRestrictedSchema, valid: { ...roomSummary, restricted: true }, invalid: { ...roomSummary, restricted: false } },
  { name: "LastSplit", schema: contracts.LastSplitSchema, valid: { mode: "tier", balanceLevel: "50-50", warning: false, at: AT }, invalid: { mode: "tier", balanceLevel: "80-20", warning: false, at: AT } },
  { name: "RoomDetail", schema: contracts.RoomDetailSchema, valid: { ...roomDetail, shareUrl: "https://example.com/rooms/AOV-1024?key=abc" }, invalid: { ...roomDetail, myRole: "admin" } },
  { name: "RoomDetailResponse", schema: contracts.RoomDetailResponseSchema, valid: { ...roomDetail, restricted: false, shareUrl: "https://example.com/rooms/AOV-1024?key=abc" }, invalid: { ...roomSummary, restricted: false } },
  { name: "RoomsQuery", schema: contracts.RoomsQuerySchema, valid: { mine: "1" }, invalid: { mine: "0" } },
  { name: "RoomsResponse", schema: contracts.RoomsResponseSchema, valid: { items: [roomSummary], total: 1, page: 1, pageSize: 10 }, invalid: { items: [roomSummary], total: -1, page: 1, pageSize: 10 } },
  { name: "CreateRoomBody", schema: contracts.CreateRoomBodySchema, valid: { title: "Phòng", mode: "normal", visibility: "public", config: { ...config, tools: [...config.tools] } }, invalid: { title: "", mode: "normal", visibility: "public", config } },
  { name: "RoomDetailQuery", schema: contracts.RoomDetailQuerySchema, valid: {}, invalid: { key: "" } },
  { name: "JoinRoomBody", schema: contracts.JoinRoomBodySchema, valid: { as: "player" }, invalid: { as: "host" } },
  { name: "UpdateRoomMeBody", schema: contracts.UpdateRoomMeBodySchema, valid: { ready: true }, invalid: {} },
  { name: "SplitRoomBody", schema: contracts.SplitRoomBodySchema, valid: { mode: "tier", balanceLevel: "60-40" }, invalid: { mode: "tier", balanceLevel: "80-20" } },
  { name: "MoveRoomMemberBody", schema: contracts.MoveRoomMemberBodySchema, valid: { userId: ID_1, to: "red" }, invalid: { userId: "bad", to: "red" } },
  { name: "KickRoomMemberBody", schema: contracts.KickRoomMemberBodySchema, valid: { userId: ID_1 }, invalid: { userId: "bad" } },
  { name: "RoomResultBody", schema: contracts.RoomResultBodySchema, valid: { winner: "blue" }, invalid: { winner: "draw" } },
  { name: "MessagesQuery", schema: contracts.MessagesQuerySchema, valid: {}, invalid: { before: "bad" } },
  { name: "CreateMessageBody", schema: contracts.CreateMessageBodySchema, valid: { text: "Xin chào" }, invalid: { text: "   " } },
  { name: "ChatMessage", schema: contracts.ChatMessageSchema, valid: chatMessage, invalid: { ...chatMessage, text: "" } },
  { name: "MessagesResponse", schema: contracts.MessagesResponseSchema, valid: [chatMessage], invalid: [chatMessage, { ...chatMessage, id: "bad" }] },
  { name: "ExportTeamsResponse", schema: contracts.ExportTeamsResponseSchema, valid: "Team Xanh", invalid: 1 },
  { name: "RoomMutationResponse", schema: contracts.RoomMutationResponseSchema, valid: roomDetail, invalid: null },
  { name: "WsClientMessage", schema: contracts.WsClientMessageSchema, valid: { type: "subscribe", room: "AOV-1024", key: "secret-key" }, invalid: { type: "subscribe", room: "AOV-1024", key: "" } },
  { name: "WsServerMessage", schema: contracts.WsServerMessageSchema, valid: { type: "error", code: "FORBIDDEN", room: "AOV-1024" }, invalid: { type: "error", code: "BAD", room: "AOV-1024" } },
  { name: "Series", schema: contracts.SeriesSchema, valid: "BO3", invalid: "BO7" },
  { name: "TournamentStatus", schema: contracts.TournamentStatusSchema, valid: "open", invalid: "waiting" },
  { name: "TeamCount", schema: contracts.TeamCountSchema, valid: 8, invalid: 12 },
  { name: "Team", schema: contracts.TeamSchema, valid: team, invalid: { ...team, id: "bad" } },
  { name: "BracketSlot", schema: contracts.BracketSlotSchema, valid: { team: null, score: null, bye: true }, invalid: { team, score: -1, bye: false } },
  { name: "BracketMatch", schema: contracts.BracketMatchSchema, valid: tournamentDetail.bracket[0]!.matches[0], invalid: { ...tournamentDetail.bracket[0]!.matches[0], slots: [] } },
  { name: "BracketRound", schema: contracts.BracketRoundSchema, valid: tournamentDetail.bracket[0], invalid: { name: "", matches: [] } },
  { name: "ScheduledMatch", schema: contracts.ScheduledMatchSchema, valid: tournamentDetail.upcoming[0], invalid: { ...tournamentDetail.upcoming[0], score: [-1, 0] } },
  { name: "TournamentSummary", schema: contracts.TournamentSummarySchema, valid: tournamentSummary, invalid: { ...tournamentSummary, teamCount: 12 } },
  { name: "Registration", schema: contracts.RegistrationSchema, valid: registration, invalid: { ...registration, members: [user] } },
  { name: "TournamentDetail", schema: contracts.TournamentDetailSchema, valid: tournamentDetail, invalid: { ...tournamentDetail, series: "BO7" } },
  { name: "TournamentsQuery", schema: contracts.TournamentsQuerySchema, valid: { sort: "deadline" }, invalid: { sort: "name" } },
  { name: "TournamentsResponse", schema: contracts.TournamentsResponseSchema, valid: { items: [tournamentSummary], total: 1, page: 1, pageSize: 10 }, invalid: { items: [], total: 0, page: 0, pageSize: 10 } },
  { name: "CreateTournamentBody", schema: contracts.CreateTournamentBodySchema, valid: { name: "Cup", description: "", intro: [], teamCount: 8, series: "BO3", registrationDeadline: AT, drawDate: "2026-11-16T12:00:00+07:00", dateStart: "2026-11-17T12:00:00+07:00", dateEnd: "2026-11-18T12:00:00+07:00", rules: [], prizes: [], cover: "tour-1" }, invalid: { name: "Cup", description: "", intro: [], teamCount: 12, series: "BO3", registrationDeadline: AT, drawDate: AT, dateStart: AT, dateEnd: AT, rules: [], prizes: [], cover: "tour-1" } },
  { name: "UpdateTournamentBody", schema: contracts.UpdateTournamentBodySchema, valid: { description: "Mới" }, invalid: {} },
  { name: "CreateRegistrationBody", schema: contracts.CreateRegistrationBodySchema, valid: { teamName: "Ngũ Hổ", members: ["suthy", "user2", "user3", "user4", "user5"], subs: ["user6"] }, invalid: { teamName: "Ngũ Hổ", members: ["suthy", "user2"] } },
  { name: "RejectRegistrationBody", schema: contracts.RejectRegistrationBodySchema, valid: {}, invalid: { reason: 1 } },
  { name: "ScoreMatchBody", schema: contracts.ScoreMatchBodySchema, valid: { scoreA: 2, scoreB: 1 }, invalid: { scoreA: -1, scoreB: 1 } },
  { name: "ScheduleMatchBody", schema: contracts.ScheduleMatchBodySchema, valid: { scheduledAt: AT }, invalid: { scheduledAt: "tomorrow" } },
  { name: "RegistrationsResponse", schema: contracts.RegistrationsResponseSchema, valid: [registration], invalid: [{ ...registration, id: "bad" }] },
  { name: "RegistrationResponse", schema: contracts.RegistrationResponseSchema, valid: registration, invalid: null },
  { name: "TournamentMutationResponse", schema: contracts.TournamentMutationResponseSchema, valid: tournamentDetail, invalid: null },
  { name: "DeleteRegistrationResponse", schema: contracts.DeleteRegistrationResponseSchema, valid: undefined, invalid: null },
  { name: "SeriesScoreBody", schema: contracts.SeriesScoreBodySchema, valid: { series: "BO3", scoreA: 2, scoreB: 1 }, invalid: { series: "BO3", scoreA: 1, scoreB: 1 } },
  { name: "Activity", schema: contracts.ActivitySchema, valid: { id: ID_1, kind: "join", text: "Đã vào phòng", at: AT }, invalid: { id: ID_1, kind: "other", text: "Đã vào phòng", at: AT } },
  { name: "ActivitiesQuery", schema: contracts.ActivitiesQuerySchema, valid: {}, invalid: { pageSize: 51 } },
  { name: "ActivitiesResponse", schema: contracts.ActivitiesResponseSchema, valid: { items: [], total: 0, page: 1, pageSize: 10 }, invalid: { items: [], total: -1, page: 1, pageSize: 10 } },
  { name: "SearchQuery", schema: contracts.SearchQuerySchema, valid: { q: "ng" }, invalid: { q: "n" } },
  { name: "SearchResponse", schema: contracts.SearchResponseSchema, valid: { rooms: [roomSummary], tournaments: [tournamentSummary], users: [user] }, invalid: { rooms: [], tournaments: [], users: [null] } },
];

for (const schemaCase of schemaCases) {
  test(`${schemaCase.name} schema accepts valid input and rejects invalid input`, () => {
    assert.equal(schemaCase.schema.safeParse(schemaCase.valid).success, true);
    assert.equal(schemaCase.schema.safeParse(schemaCase.invalid).success, false);
  });
}

test("create tournament enforces chronological dates", () => {
  const result = contracts.CreateTournamentBodySchema.safeParse({
    name: "Cup",
    description: "",
    intro: [],
    teamCount: 8,
    series: "BO3",
    registrationDeadline: "2026-11-18T12:00:00+07:00",
    drawDate: "2026-11-17T12:00:00+07:00",
    dateStart: "2026-11-16T12:00:00+07:00",
    dateEnd: "2026-11-15T12:00:00+07:00",
    rules: [],
    prizes: [],
    cover: "tour-1",
  });
  assert.equal(result.success, false);
});

test("normalizeVi removes Vietnamese marks including đ and Đ", () => {
  assert.equal(contracts.normalizeVi("Ngũ Kiệt ĐẠI CHIẾN"), "ngu kiet dai chien");
});

test("isValidSeriesScore validates BO1, BO3 and BO5", () => {
  assert.equal(contracts.isValidSeriesScore("BO1", 1, 0), true);
  assert.equal(contracts.isValidSeriesScore("BO1", 1, 1), false);
  assert.equal(contracts.isValidSeriesScore("BO3", 2, 0), true);
  assert.equal(contracts.isValidSeriesScore("BO3", 2, 1), true);
  assert.equal(contracts.isValidSeriesScore("BO3", 1, 0), false);
  assert.equal(contracts.isValidSeriesScore("BO5", 3, 2), true);
  assert.equal(contracts.isValidSeriesScore("BO5", 4, 2), false);
});

test("moveMember swaps two players", () => {
  const teams: Teams = { blue: [member(user)], red: [member(otherUser, "JG")] };
  const result = contracts.moveMember(teams, ID_1, "red", 5, ID_2);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.teams.blue[0]!.user.id, ID_2);
    assert.equal(result.teams.red[0]!.user.id, ID_1);
    assert.equal(result.swapped, "Alpha");
  }
});

test("moveMember transfers to a team with capacity", () => {
  const teams: Teams = { blue: [member(user)], red: [] };
  const result = contracts.moveMember(teams, ID_1, "red", 5);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.teams.red[0]!.user.id, ID_1);
});

test("moveMember rejects a full destination team", () => {
  const teams: Teams = { blue: [member(user)], red: [member(otherUser)] };
  assert.deepEqual(contracts.moveMember(teams, ID_1, "red", 1), {
    ok: false,
    message: "Đội kia đã đủ người. Thả lên một người chơi để đổi chỗ.",
  });
});

test("moveMember rejects a player no longer in the room", () => {
  const teams: Teams = { blue: [member(user)], red: [] };
  assert.deepEqual(contracts.moveMember(teams, ID_3, "red", 5), {
    ok: false,
    message: "Người chơi không còn trong phòng.",
  });
});

test("room pure helpers preserve permissions, removal and export formatting", () => {
  const teams: Teams = {
    blue: [member(user, "MID")],
    red: [member(otherUser, null)],
  };
  assert.equal(contracts.can("host", "kick"), true);
  assert.equal(contracts.can("spectator", "chat"), false);
  assert.equal(contracts.removeMember(teams, ID_2).red.length, 0);
  assert.match(
    contracts.formatTeamsText(roomSummary, teams),
    /Phòng #AOV-1024 – Phòng cộng đồng[\s\S]*Team Xanh \(1\)[\s\S]*Sư Thầy \(MID\) ★[\s\S]*Team Đỏ \(1\)[\s\S]*Alpha \(Chưa chọn\)/,
  );
});

test("API.md section 9 contract rules: restricted union, trim message, unscheduled match, TBD/bye slot", () => {
  assert.equal(
    contracts.RoomDetailResponseSchema.safeParse({ ...roomSummary, restricted: true }).success,
    true,
  );
  const msg = contracts.CreateMessageBodySchema.parse({ text: "  Xin chào  " });
  assert.equal(msg.text, "Xin chào");
  assert.equal(
    contracts.ScheduledMatchSchema.safeParse({
      id: ID_3,
      stage: "Bán kết",
      time: "Chưa xếp lịch",
      home: team,
      away: team2,
    }).success,
    true,
  );
  assert.equal(
    contracts.BracketSlotSchema.safeParse({ team: null, score: null, bye: false }).success,
    true,
  );
});
