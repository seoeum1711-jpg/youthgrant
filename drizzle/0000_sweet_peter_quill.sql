CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`raw_notice_id` text NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`content_type` text,
	`text_extracted` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`raw_notice_id`) REFERENCES `raw_notices`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_attachments_raw_notice` ON `attachments` (`raw_notice_id`);--> statement-breakpoint
CREATE TABLE `collection_locks` (
	`name` text PRIMARY KEY NOT NULL,
	`holder` text NOT NULL,
	`acquired_at` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `crawl_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`trigger` text NOT NULL,
	`error_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `opportunities` (
	`id` text PRIMARY KEY NOT NULL,
	`dedupe_key` text NOT NULL,
	`title` text NOT NULL,
	`organization` text NOT NULL,
	`region` text NOT NULL,
	`field` text,
	`facility_types_json` text DEFAULT '[]' NOT NULL,
	`application_start` text,
	`deadline` text,
	`deadline_verification` text NOT NULL,
	`deadline_evidence` text,
	`deadline_evidence_location` text,
	`eligibility_verification` text NOT NULL,
	`eligibility_evidence` text,
	`eligibility_evidence_location` text,
	`amount_won` integer,
	`amount_text` text,
	`self_burden` text,
	`support_details` text,
	`review_status` text NOT NULL,
	`published_at` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_opportunities_dedupe_key` ON `opportunities` (`dedupe_key`);--> statement-breakpoint
CREATE INDEX `idx_opportunities_public_region` ON `opportunities` (`review_status`,`region`);--> statement-breakpoint
CREATE INDEX `idx_opportunities_deadline` ON `opportunities` (`deadline_verification`,`deadline`);--> statement-breakpoint
CREATE TABLE `opportunity_sources` (
	`opportunity_id` text NOT NULL,
	`raw_notice_id` text NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`opportunity_id`, `raw_notice_id`),
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`raw_notice_id`) REFERENCES `raw_notices`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_opportunity_sources_raw` ON `opportunity_sources` (`raw_notice_id`);--> statement-breakpoint
CREATE TABLE `raw_notices` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`source_run_id` text,
	`source_notice_id` text,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`published_at` text,
	`raw_text` text NOT NULL,
	`dedupe_key` text NOT NULL,
	`collected_at` text NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_run_id`) REFERENCES `source_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_raw_notices_dedupe_key` ON `raw_notices` (`dedupe_key`);--> statement-breakpoint
CREATE INDEX `idx_raw_notices_source_collected` ON `raw_notices` (`source_id`,`collected_at`);--> statement-breakpoint
CREATE TABLE `saved_opportunities` (
	`id` text PRIMARY KEY NOT NULL,
	`visitor_key` text NOT NULL,
	`opportunity_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_saved_visitor_opportunity` ON `saved_opportunities` (`visitor_key`,`opportunity_id`);--> statement-breakpoint
CREATE TABLE `source_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`crawl_run_id` text NOT NULL,
	`source_id` text NOT NULL,
	`status` text NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`found` integer DEFAULT 0 NOT NULL,
	`inserted` integer DEFAULT 0 NOT NULL,
	`matched` integer DEFAULT 0 NOT NULL,
	`error` text,
	FOREIGN KEY (`crawl_run_id`) REFERENCES `crawl_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_source_runs_crawl_source` ON `source_runs` (`crawl_run_id`,`source_id`);--> statement-breakpoint
CREATE INDEX `idx_source_runs_source_started` ON `source_runs` (`source_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `sources` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`method` text NOT NULL,
	`region` text NOT NULL,
	`url` text NOT NULL,
	`implemented` integer DEFAULT false NOT NULL,
	`health` text DEFAULT 'YELLOW' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
