CREATE TYPE "public"."entity_type" AS ENUM('repo', 'topic', 'hn_story');--> statement-breakpoint
CREATE TABLE "entities" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"type" "entity_type" NOT NULL,
	"source_key" text NOT NULL,
	"name" text NOT NULL,
	"url" text,
	"description" text,
	"language" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_tags" (
	"entity_id" bigint NOT NULL,
	"tag_id" bigint NOT NULL,
	CONSTRAINT "entity_tags_entity_id_tag_id_pk" PRIMARY KEY("entity_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "snapshots" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"entity_id" bigint NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"stars" integer,
	"stars_delta" integer,
	"hn_points" integer,
	"hn_comments" integer,
	"momentum_score" numeric(8, 3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tech_tags" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "tech_tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"github_id" bigint NOT NULL,
	"email" text,
	"name" text,
	"image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_github_id_unique" UNIQUE("github_id")
);
--> statement-breakpoint
CREATE TABLE "watches" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"entity_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entity_tags" ADD CONSTRAINT "entity_tags_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_tags" ADD CONSTRAINT "entity_tags_tag_id_tech_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tech_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watches" ADD CONSTRAINT "watches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watches" ADD CONSTRAINT "watches_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "entities_type_source_key_uq" ON "entities" USING btree ("type","source_key");--> statement-breakpoint
CREATE INDEX "entities_language_idx" ON "entities" USING btree ("language");--> statement-breakpoint
CREATE UNIQUE INDEX "snapshots_entity_captured_uq" ON "snapshots" USING btree ("entity_id","captured_at");--> statement-breakpoint
CREATE INDEX "snapshots_latest_idx" ON "snapshots" USING btree ("entity_id","captured_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "snapshots_score_idx" ON "snapshots" USING btree ("captured_at" DESC NULLS LAST,"momentum_score" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "watches_user_entity_uq" ON "watches" USING btree ("user_id","entity_id");