ALTER TABLE `pitch_queue` ADD `spectate_opt_in` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `pitch_rooms` ADD `is_public` integer DEFAULT 0 NOT NULL;