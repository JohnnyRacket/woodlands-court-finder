CREATE TABLE `slots` (
	`court_id` text NOT NULL,
	`date` text NOT NULL,
	`hour` integer NOT NULL,
	`status` text NOT NULL,
	`fetched_at` text NOT NULL,
	PRIMARY KEY(`court_id`, `date`, `hour`),
	FOREIGN KEY (`court_id`) REFERENCES `courts`(`id`) ON UPDATE no action ON DELETE no action
);
