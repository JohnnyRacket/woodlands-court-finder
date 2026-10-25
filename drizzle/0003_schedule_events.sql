CREATE TABLE `schedule_events` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`park_id` text NOT NULL,
	`court_kind` text,
	`date` text NOT NULL,
	`start_min` integer NOT NULL,
	`end_min` integer NOT NULL,
	`public_can_join` integer NOT NULL,
	`url` text,
	FOREIGN KEY (`park_id`) REFERENCES `parks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `schedule_events_park_date` ON `schedule_events` (`park_id`,`date`);