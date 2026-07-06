CREATE TABLE `stack_items` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`item_id` text,
	`tool_name` text,
	`status` text DEFAULT 'using' NOT NULL,
	`take` text,
	`rating` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `stack_user_idx` ON `stack_items` (`user_id`);--> statement-breakpoint
CREATE INDEX `stack_item_idx` ON `stack_items` (`item_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `stack_user_item_idx` ON `stack_items` (`user_id`,`item_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `stack_user_tool_idx` ON `stack_items` (`user_id`,`tool_name`);