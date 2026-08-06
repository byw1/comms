CREATE TABLE "saved_views" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"icon" text DEFAULT 'Filter' NOT NULL,
	"filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_shared" boolean DEFAULT false NOT NULL,
	"owner_user_id" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tag_suggestions" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"dismissed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tag_suggestions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "follow_up_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "follow_up_armed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "follow_up_user_id" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "scheduled_for" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "macros" ADD COLUMN "usage_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "macros" ADD COLUMN "last_used_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "automation_rules" ADD COLUMN "stop_processing" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "automation_rules" ADD COLUMN "fire_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "automation_rules" ADD COLUMN "last_fired_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "automation_rules" ADD COLUMN "last_conversation_number" integer;--> statement-breakpoint
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "saved_views_owner_idx" ON "saved_views" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "tag_suggestions_count_idx" ON "tag_suggestions" USING btree ("count");--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_follow_up_user_id_users_id_fk" FOREIGN KEY ("follow_up_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;