CREATE TABLE `cron_watchdog_alerts` (
	`expected_scheduled_at` text PRIMARY KEY NOT NULL,
	`claimed_at` text NOT NULL
);
