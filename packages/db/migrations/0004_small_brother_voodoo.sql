ALTER TYPE "public"."notification_type" ADD VALUE 'system';--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "opted_out_at" timestamp with time zone;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_body_fts_idx" ON "messages" USING gin (to_tsvector('english', coalesce("body", '')));--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contacts_display_name_trgm_idx" ON "contacts" USING gin ("display_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversations_title_trgm_idx" ON "conversations" USING gin ("title" gin_trgm_ops);
