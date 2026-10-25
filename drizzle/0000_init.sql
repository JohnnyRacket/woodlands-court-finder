CREATE TABLE `courts` (
	`id` text PRIMARY KEY NOT NULL,
	`park_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`lighted` integer,
	`geometry` text,
	`gis_id` text,
	`activenet_id` integer,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`park_id`) REFERENCES `parks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `courts_activenet_id_unique` ON `courts` (`activenet_id`);--> statement-breakpoint
CREATE TABLE `parks` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text NOT NULL,
	`ok` integer NOT NULL,
	`rows` integer DEFAULT 0 NOT NULL,
	`error` text,
	`notes` text
);
