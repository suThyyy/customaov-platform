ALTER TABLE "tournament_team_members" DROP CONSTRAINT "tournament_team_members_tournament_id_user_id_unique";--> statement-breakpoint
ALTER TABLE "bracket_matches" ADD COLUMN "is_bye" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "room_members" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "tournament_team_members" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "room_members_active_player_uidx" ON "room_members" USING btree ("user_id") WHERE "room_members"."role" = 'player' AND "room_members"."active";--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_team_members_active_uidx" ON "tournament_team_members" USING btree ("tournament_id","user_id") WHERE "tournament_team_members"."active";