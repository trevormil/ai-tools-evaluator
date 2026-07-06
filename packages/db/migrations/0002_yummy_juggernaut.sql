CREATE TABLE `subscribers` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`confirmed_at` integer,
	`unsubscribed_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscribers_email_unique` ON `subscribers` (`email`);--> statement-breakpoint
CREATE INDEX `subscribers_status_idx` ON `subscribers` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `subscribers_token_idx` ON `subscribers` (`token`);