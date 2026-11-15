import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export interface RoomConfigJson {
  format: "5v5";
  pickMode: "draft" | "blind" | "random";
  series: "BO1" | "BO3" | "BO5";
  tools: Array<"balance" | "lane" | "champion" | "mystery" | "chat">;
  notes: string;
}

export interface RoomLastSplitJson {
  mode: "random" | "tier";
  balanceLevel: "50-50" | "60-40" | "70-30" | null;
  warning: string | null;
  at: string;
}

export interface TournamentPrizeJson {
  place: string;
  reward: string;
}

export const users = pgTable(
  "users",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    uid: text("uid").notNull().unique(),
    username: text("username").notNull().unique(),
    displayName: text("display_name").notNull(),
    passwordHash: text("password_hash").notNull(),
    avatarUrl: text("avatar_url"),
    bio: text("bio"),
    bioExtra: text("bio_extra"),
    roleBadge: text("role_badge"),
    playerBadge: text("player_badge"),
    level: integer("level").notNull().default(1),
    crowned: boolean("crowned").notNull().default(false),
    searchText: text("search_text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [check("users_uid_format_check", sql`${table.uid} ~ '^[0-9]{6}$'`)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);

export const rooms = pgTable(
  "rooms",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    code: text("code").notNull().unique(),
    title: text("title").notNull(),
    highlight: text("highlight"),
    thumbnail: text("thumbnail").notNull(),
    hostId: uuid("host_id")
      .notNull()
      .references(() => users.id),
    mode: text("mode").notNull(),
    visibility: text("visibility").notNull(),
    capacity: integer("capacity").notNull().default(10),
    status: text("status").notNull(),
    config: jsonb("config").$type<RoomConfigJson>().notNull(),
    joinKey: text("join_key"),
    lastSplit: jsonb("last_split").$type<RoomLastSplitJson | null>(),
    searchText: text("search_text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => [
    index("rooms_status_visibility_idx").on(table.status, table.visibility),
    check(
      "rooms_mode_check",
      sql`${table.mode} IN ('normal', 'tournament', 'friendly', 'other')`,
    ),
    check(
      "rooms_visibility_check",
      sql`${table.visibility} IN ('public', 'private')`,
    ),
    check(
      "rooms_status_check",
      sql`${table.status} IN ('waiting', 'live', 'finished')`,
    ),
  ],
);

export const roomMembers = pgTable(
  "room_members",
  {
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    side: text("side"),
    lane: text("lane"),
    ready: boolean("ready").notNull().default(false),
    captain: boolean("captain").notNull().default(false),
    tier: smallint("tier"),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    position: integer("position").notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.roomId, table.userId] }),
    index("room_members_user_id_idx").on(table.userId),
    check("room_members_role_check", sql`${table.role} IN ('player', 'spectator')`),
    check(
      "room_members_side_check",
      sql`${table.side} IS NULL OR ${table.side} IN ('blue', 'red')`,
    ),
  ],
);

export const roomMessages = pgTable(
  "room_messages",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id, {
      onDelete: "set null",
    }),
    text: text("text").notNull(),
    system: boolean("system").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("room_messages_room_id_created_at_idx").on(
      table.roomId,
      table.createdAt,
    ),
  ],
);

export const roomMatches = pgTable(
  "room_matches",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    winner: text("winner").notNull(),
    blueUserIds: uuid("blue_user_ids").array().notNull(),
    redUserIds: uuid("red_user_ids").array().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("room_matches_room_id_idx").on(table.roomId)],
);

export const tournaments = pgTable(
  "tournaments",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    titleAccent: text("title_accent"),
    description: text("description").notNull(),
    intro: jsonb("intro").$type<string[]>().notNull(),
    organizerId: uuid("organizer_id")
      .notNull()
      .references(() => users.id),
    status: text("status").notNull(),
    teamCount: integer("team_count").notNull(),
    series: text("series").notNull(),
    cover: text("cover").notNull(),
    registrationDeadline: timestamp("registration_deadline", {
      withTimezone: true,
    }).notNull(),
    drawDate: timestamp("draw_date", { withTimezone: true }).notNull(),
    dateStart: timestamp("date_start", { withTimezone: true }).notNull(),
    dateEnd: timestamp("date_end", { withTimezone: true }).notNull(),
    rules: jsonb("rules").$type<string[]>().notNull(),
    prizes: jsonb("prizes").$type<TournamentPrizeJson[]>().notNull(),
    championTeamId: uuid("champion_team_id"),
    searchText: text("search_text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("tournaments_status_idx").on(table.status),
    check(
      "tournaments_status_check",
      sql`${table.status} IN ('open', 'live', 'finished')`,
    ),
    check(
      "tournaments_series_check",
      sql`${table.series} IN ('BO1', 'BO3', 'BO5')`,
    ),
  ],
);

export const tournamentTeams = pgTable(
  "tournament_teams",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    logo: text("logo").notNull(),
    captainId: uuid("captain_id")
      .notNull()
      .references(() => users.id),
    status: text("status").notNull(),
    rejectReason: text("reject_reason"),
    seed: integer("seed"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("tournament_teams_tournament_id_lower_name_uidx").on(
      table.tournamentId,
      sql`lower(${table.name})`,
    ),
    check(
      "tournament_teams_status_check",
      sql`${table.status} IN ('pending', 'approved', 'rejected', 'withdrawn')`,
    ),
  ],
);

export const tournamentTeamMembers = pgTable(
  "tournament_team_members",
  {
    teamId: uuid("team_id")
      .notNull()
      .references(() => tournamentTeams.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    isSub: boolean("is_sub").notNull().default(false),
  },
  (table) => [
    primaryKey({ columns: [table.teamId, table.userId] }),
    unique("tournament_team_members_tournament_id_user_id_unique").on(
      table.tournamentId,
      table.userId,
    ),
  ],
);

export const bracketMatches = pgTable(
  "bracket_matches",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    round: integer("round").notNull(),
    position: integer("position").notNull(),
    label: text("label").notNull(),
    teamAId: uuid("team_a_id").references(() => tournamentTeams.id, {
      onDelete: "set null",
    }),
    teamBId: uuid("team_b_id").references(() => tournamentTeams.id, {
      onDelete: "set null",
    }),
    scoreA: integer("score_a"),
    scoreB: integer("score_b"),
    winnerTeamId: uuid("winner_team_id").references(() => tournamentTeams.id, {
      onDelete: "set null",
    }),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    nextMatchId: uuid("next_match_id"),
    nextSlot: text("next_slot"),
  },
  (table) => [
    unique("bracket_matches_tournament_id_round_position_unique").on(
      table.tournamentId,
      table.round,
      table.position,
    ),
    check(
      "bracket_matches_next_slot_check",
      sql`${table.nextSlot} IS NULL OR ${table.nextSlot} IN ('a', 'b')`,
    ),
  ],
);

export const activities = pgTable(
  "activities",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    kind: text("kind").notNull(),
    actorId: uuid("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    roomId: uuid("room_id").references(() => rooms.id, {
      onDelete: "set null",
    }),
    tournamentId: uuid("tournament_id").references(() => tournaments.id, {
      onDelete: "set null",
    }),
    text: text("text").notNull(),
    emphasis: text("emphasis"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("activities_created_at_idx").on(table.createdAt),
    check(
      "activities_kind_check",
      sql`${table.kind} IN ('join', 'register', 'invite', 'result')`,
    ),
  ],
);

export const activityRecipients = pgTable(
  "activity_recipients",
  {
    activityId: uuid("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.activityId, table.userId] }),
    index("activity_recipients_user_id_idx").on(table.userId),
  ],
);
