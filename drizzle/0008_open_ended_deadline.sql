ALTER TABLE `opportunities` ADD `deadline_mode` text DEFAULT 'UNKNOWN' NOT NULL;
--> statement-breakpoint
UPDATE `opportunities`
SET `deadline_mode` = 'FIXED_DATE'
WHERE `deadline` IS NOT NULL
  AND `deadline_verification` IN ('VERIFIED', 'MANUAL_CONFIRMED');
