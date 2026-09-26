CREATE TABLE `pitch_practice_logs` (
	`id` text NOT NULL,
	`player_id` text NOT NULL,
	`scenario_id` text NOT NULL,
	`scenario_json` text NOT NULL,
	`transcript` text NOT NULL,
	`feedback` text NOT NULL,
	`delivery_json` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`player_id`, `id`),
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `pitch_practice_player_date` ON `pitch_practice_logs` (`player_id`,`created_at`);