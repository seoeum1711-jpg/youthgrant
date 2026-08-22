ALTER TABLE `raw_notices` ADD `relevance_status` text DEFAULT 'IN_SCOPE' NOT NULL;--> statement-breakpoint
ALTER TABLE `raw_notices` ADD `relevance_reason` text;--> statement-breakpoint
ALTER TABLE `raw_notices` ADD `relevance_checked_at` text;--> statement-breakpoint
CREATE INDEX `idx_raw_notices_relevance` ON `raw_notices` (`relevance_status`);