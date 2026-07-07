ALTER TABLE `items` ADD `primary_audience` text;--> statement-breakpoint
ALTER TABLE `items` ADD `ai_engineer_fit` integer;--> statement-breakpoint
ALTER TABLE `items` ADD `vibe_coder_fit` integer;--> statement-breakpoint
CREATE INDEX `items_audience_idx` ON `items` (`primary_audience`);