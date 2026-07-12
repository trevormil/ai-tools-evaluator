DROP TABLE `activities`;--> statement-breakpoint
DROP TABLE `articles`;--> statement-breakpoint
DROP TABLE `comments`;--> statement-breakpoint
DROP TABLE `follows`;--> statement-breakpoint
DROP TABLE `messages`;--> statement-breakpoint
DROP TABLE `notifications`;--> statement-breakpoint
DROP TABLE `posts`;--> statement-breakpoint
DROP TABLE `profile_links`;--> statement-breakpoint
DROP TABLE `reposts`;--> statement-breakpoint
DROP TABLE `sessions`;--> statement-breakpoint
DROP TABLE `stack_items`;--> statement-breakpoint
DROP TABLE `subscribers`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
DROP TABLE `votes`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_items` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`kind` text NOT NULL,
	`external_id` text NOT NULL,
	`url` text NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`integration` text NOT NULL,
	`verdict` text NOT NULL,
	`primary_audience` text,
	`ai_engineer_fit` integer,
	`vibe_coder_fit` integer,
	`overall_score` integer NOT NULL,
	`noise_score` integer NOT NULL,
	`tagline` text NOT NULL,
	`tags_json` text DEFAULT '[]' NOT NULL,
	`evaluation_json` text NOT NULL,
	`media_json` text DEFAULT '[]' NOT NULL,
	`cover_image_url` text,
	`readme_md` text,
	`evaluated_by` text DEFAULT 'ai' NOT NULL,
	`model` text,
	`published` integer DEFAULT true NOT NULL,
	`score_status` text DEFAULT 'scored' NOT NULL,
	`scored_at` integer,
	`daily_pick_at` integer,
	`score` real DEFAULT 0 NOT NULL,
	`upvotes` integer DEFAULT 0 NOT NULL,
	`comment_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_items`("id", "slug", "kind", "external_id", "url", "title", "category", "integration", "verdict", "primary_audience", "ai_engineer_fit", "vibe_coder_fit", "overall_score", "noise_score", "tagline", "tags_json", "evaluation_json", "media_json", "cover_image_url", "readme_md", "evaluated_by", "model", "published", "score_status", "scored_at", "daily_pick_at", "score", "upvotes", "comment_count", "created_at") SELECT "id", "slug", "kind", "external_id", "url", "title", "category", "integration", "verdict", "primary_audience", "ai_engineer_fit", "vibe_coder_fit", "overall_score", "noise_score", "tagline", "tags_json", "evaluation_json", "media_json", "cover_image_url", "readme_md", "evaluated_by", "model", "published", "score_status", "scored_at", "daily_pick_at", "score", "upvotes", "comment_count", "created_at" FROM `items`;--> statement-breakpoint
DROP TABLE `items`;--> statement-breakpoint
ALTER TABLE `__new_items` RENAME TO `items`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `items_slug_unique` ON `items` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `items_external_idx` ON `items` (`kind`,`external_id`);--> statement-breakpoint
CREATE INDEX `items_category_idx` ON `items` (`category`);--> statement-breakpoint
CREATE INDEX `items_verdict_idx` ON `items` (`verdict`);--> statement-breakpoint
CREATE INDEX `items_audience_idx` ON `items` (`primary_audience`);--> statement-breakpoint
CREATE INDEX `items_created_idx` ON `items` (`created_at`);--> statement-breakpoint
CREATE INDEX `items_score_idx` ON `items` (`score`);--> statement-breakpoint
CREATE TABLE `__new_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`note` text,
	`source` text DEFAULT 'web' NOT NULL,
	`discord_user_id` text,
	`status` text DEFAULT 'queued' NOT NULL,
	`reason` text,
	`item_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`processed_at` integer,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_submissions`("id", "url", "note", "source", "discord_user_id", "status", "reason", "item_id", "created_at", "processed_at") SELECT "id", "url", "note", "source", "discord_user_id", "status", "reason", "item_id", "created_at", "processed_at" FROM `submissions`;--> statement-breakpoint
DROP TABLE `submissions`;--> statement-breakpoint
ALTER TABLE `__new_submissions` RENAME TO `submissions`;--> statement-breakpoint
CREATE INDEX `submissions_status_idx` ON `submissions` (`status`);--> statement-breakpoint
CREATE INDEX `submissions_url_idx` ON `submissions` (`url`);