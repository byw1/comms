CREATE TYPE "public"."conversation_kind" AS ENUM('person', 'unknown', 'automated', 'otp');--> statement-breakpoint
CREATE TYPE "public"."view_display" AS ENUM('sidebar', 'section');--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "owner_team_id" text;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "kind" "conversation_kind" DEFAULT 'person' NOT NULL;--> statement-breakpoint
ALTER TABLE "saved_views" ADD COLUMN "display" "view_display" DEFAULT 'sidebar' NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_owner_team_id_teams_id_fk" FOREIGN KEY ("owner_team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contacts_owner_team_idx" ON "contacts" USING btree ("owner_team_id");--> statement-breakpoint
CREATE INDEX "conversations_team_idx" ON "conversations" USING btree ("assigned_team_id");--> statement-breakpoint
CREATE INDEX "conversations_kind_idx" ON "conversations" USING btree ("kind");