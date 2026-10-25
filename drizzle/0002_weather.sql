CREATE TABLE `weather_hours` (
	`date` text NOT NULL,
	`hour` integer NOT NULL,
	`temp_f` integer NOT NULL,
	`precip_pct` integer NOT NULL,
	`wind_mph` integer NOT NULL,
	`short_forecast` text NOT NULL,
	`is_daytime` integer NOT NULL,
	`fetched_at` text NOT NULL,
	PRIMARY KEY(`date`, `hour`)
);
