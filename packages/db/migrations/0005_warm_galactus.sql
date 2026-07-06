CREATE TABLE `profile_links` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`url` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profile_links_user_kind_idx` ON `profile_links` (`user_id`,`kind`);--> statement-breakpoint
CREATE INDEX `profile_links_user_idx` ON `profile_links` (`user_id`);