ALTER TABLE "activities" ADD CONSTRAINT "activities_kind_check" CHECK ("activities"."kind" IN ('join', 'register', 'invite', 'result'));--> statement-breakpoint
ALTER TABLE "bracket_matches" ADD CONSTRAINT "bracket_matches_next_slot_check" CHECK ("bracket_matches"."next_slot" IS NULL OR "bracket_matches"."next_slot" IN ('a', 'b'));--> statement-breakpoint
ALTER TABLE "room_members" ADD CONSTRAINT "room_members_role_check" CHECK ("room_members"."role" IN ('player', 'spectator'));--> statement-breakpoint
ALTER TABLE "room_members" ADD CONSTRAINT "room_members_side_check" CHECK ("room_members"."side" IS NULL OR "room_members"."side" IN ('blue', 'red'));--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_mode_check" CHECK ("rooms"."mode" IN ('normal', 'tournament', 'friendly', 'other'));--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_visibility_check" CHECK ("rooms"."visibility" IN ('public', 'private'));--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_status_check" CHECK ("rooms"."status" IN ('waiting', 'live', 'finished'));--> statement-breakpoint
ALTER TABLE "tournament_teams" ADD CONSTRAINT "tournament_teams_status_check" CHECK ("tournament_teams"."status" IN ('pending', 'approved', 'rejected', 'withdrawn'));--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_status_check" CHECK ("tournaments"."status" IN ('open', 'live', 'finished'));--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_series_check" CHECK ("tournaments"."series" IN ('BO1', 'BO3', 'BO5'));--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_uid_format_check" CHECK ("users"."uid" ~ '^[0-9]{6}$');