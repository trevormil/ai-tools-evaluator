ALTER TABLE `items` ADD `scored_at` integer;--> statement-breakpoint
UPDATE `items` SET `scored_at` = `created_at` WHERE `score_status` = 'scored' AND `scored_at` IS NULL;
