DROP INDEX `stack_user_tool_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `stack_user_tool_idx` ON `stack_items` (`user_id`,lower("tool_name"));