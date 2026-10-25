CREATE TABLE `slot_changes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`court_id` text NOT NULL,
	`date` text NOT NULL,
	`hour` integer NOT NULL,
	`status` text NOT NULL,
	`previous_status` text,
	`observed_at` text NOT NULL,
	FOREIGN KEY (`court_id`) REFERENCES `courts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `slot_changes_date_court` ON `slot_changes` (`date`,`court_id`);--> statement-breakpoint
CREATE TABLE `weather_alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`event` text NOT NULL,
	`headline` text,
	`severity` text NOT NULL,
	`description` text,
	`instruction` text,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`first_seen_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`active` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rain_hours` (
	`date` text NOT NULL,
	`hour` integer NOT NULL,
	`precip_in` real NOT NULL,
	`fetched_at` text NOT NULL,
	PRIMARY KEY(`date`, `hour`)
);
--> statement-breakpoint
CREATE TABLE `township_alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`severity` integer NOT NULL,
	`park_ids` text NOT NULL,
	`about_courts` integer NOT NULL,
	`first_seen_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`active` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `park_events` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`park_id` text NOT NULL,
	`date` text NOT NULL,
	`start_min` integer,
	`end_min` integer,
	`venue` text NOT NULL,
	`tags` text NOT NULL,
	`url` text NOT NULL,
	FOREIGN KEY (`park_id`) REFERENCES `parks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `park_events_park_date` ON `park_events` (`park_id`,`date`);--> statement-breakpoint
CREATE TABLE `weather_details` (
	`date` text NOT NULL,
	`hour` integer NOT NULL,
	`gust_mph` integer,
	`thunder_pct` integer,
	`heat_index_f` integer,
	`wbgt_f` integer,
	`rain_in` real,
	`fetched_at` text NOT NULL,
	PRIMARY KEY(`date`, `hour`)
);
