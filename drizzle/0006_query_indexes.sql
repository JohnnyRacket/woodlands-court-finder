DROP INDEX `schedule_events_park_date`;--> statement-breakpoint
CREATE INDEX `schedule_events_date_park` ON `schedule_events` (`date`,`park_id`);--> statement-breakpoint
DROP INDEX `park_events_park_date`;--> statement-breakpoint
CREATE INDEX `park_events_date` ON `park_events` (`date`);--> statement-breakpoint
CREATE INDEX `sync_runs_source_ok` ON `sync_runs` (`source`,`ok`);--> statement-breakpoint
CREATE INDEX `slots_date` ON `slots` (`date`);