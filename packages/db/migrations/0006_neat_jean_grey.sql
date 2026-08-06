ALTER TABLE "channel_connections" ADD COLUMN "webhook_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "channel_connections" ADD COLUMN "contacts_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "avatar_storage_key" text;--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "uti" text;--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "is_voice_memo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "playable_storage_key" text;--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "playable_mime_type" text;--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "transcript" text;--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "transcript_source" text;