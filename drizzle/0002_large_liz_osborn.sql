CREATE TABLE `pitch_accounts` (
	`player_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`password_salt` text NOT NULL,
	`birth_date` text NOT NULL,
	`accepted_at` integer NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pitch_accounts_email_unique` ON `pitch_accounts` (`email`);--> statement-breakpoint
CREATE TABLE `pitch_ballots` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`judge_id` text NOT NULL,
	`winner_id` text NOT NULL,
	`a_clarity` integer NOT NULL,
	`a_persuasiveness` integer NOT NULL,
	`a_composure` integer NOT NULL,
	`a_tip` text NOT NULL,
	`b_clarity` integer NOT NULL,
	`b_persuasiveness` integer NOT NULL,
	`b_composure` integer NOT NULL,
	`b_tip` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `pitch_rooms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`judge_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`winner_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "pitch_ballot_scores" CHECK("pitch_ballots"."a_clarity" BETWEEN 1 AND 5 AND "pitch_ballots"."a_persuasiveness" BETWEEN 1 AND 5 AND "pitch_ballots"."a_composure" BETWEEN 1 AND 5 AND "pitch_ballots"."b_clarity" BETWEEN 1 AND 5 AND "pitch_ballots"."b_persuasiveness" BETWEEN 1 AND 5 AND "pitch_ballots"."b_composure" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pitch_ballot_once` ON `pitch_ballots` (`room_id`,`judge_id`);--> statement-breakpoint
CREATE TABLE `pitch_blocks` (
	`player_id` text NOT NULL,
	`target_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`player_id`, `target_id`),
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "pitch_block_other" CHECK("pitch_blocks"."player_id" != "pitch_blocks"."target_id")
);
--> statement-breakpoint
CREATE TABLE `pitch_feedback_ratings` (
	`id` text PRIMARY KEY NOT NULL,
	`ballot_id` text NOT NULL,
	`player_id` text NOT NULL,
	`value` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`ballot_id`) REFERENCES `pitch_ballots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "pitch_feedback_value" CHECK("pitch_feedback_ratings"."value" IN ('helpful','unhelpful','abusive'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pitch_feedback_once` ON `pitch_feedback_ratings` (`ballot_id`,`player_id`);--> statement-breakpoint
CREATE TABLE `pitch_leaves` (
	`room_id` text NOT NULL,
	`player_id` text NOT NULL,
	`claim` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`room_id`, `player_id`),
	FOREIGN KEY (`room_id`) REFERENCES `pitch_rooms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `pitch_leaves_recent` ON `pitch_leaves` (`player_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `pitch_profiles` (
	`player_id` text PRIMARY KEY NOT NULL,
	`rating` integer DEFAULT 1000 NOT NULL,
	`games` integer DEFAULT 0 NOT NULL,
	`reliability` integer DEFAULT 75 NOT NULL,
	`judged` integer DEFAULT 0 NOT NULL,
	`priority_credits` integer DEFAULT 0 NOT NULL,
	`banned_until` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "pitch_profile_bounds" CHECK("pitch_profiles"."rating" >= 100 AND "pitch_profiles"."games" >= 0 AND "pitch_profiles"."reliability" BETWEEN 0 AND 100 AND "pitch_profiles"."priority_credits" >= 0)
);
--> statement-breakpoint
CREATE TABLE `pitch_queue` (
	`player_id` text PRIMARY KEY NOT NULL,
	`ticket` text NOT NULL,
	`role` text NOT NULL,
	`priority` integer NOT NULL,
	`band` text NOT NULL,
	`joined_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`room_id` text,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`room_id`) REFERENCES `pitch_rooms`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "pitch_queue_role" CHECK("pitch_queue"."role" IN ('contestant','judge','mixed'))
);
--> statement-breakpoint
CREATE INDEX `pitch_queue_waiting` ON `pitch_queue` (`band`,`room_id`,`expires_at`);--> statement-breakpoint
CREATE TABLE `pitch_rating_events` (
	`room_id` text NOT NULL,
	`player_id` text NOT NULL,
	`before_rating` integer NOT NULL,
	`after_rating` integer NOT NULL,
	`delta` integer NOT NULL,
	`games_before` integer NOT NULL,
	`result` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`room_id`, `player_id`),
	FOREIGN KEY (`room_id`) REFERENCES `pitch_rooms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "pitch_rating_integrity" CHECK("pitch_rating_events"."after_rating" >= 100 AND "pitch_rating_events"."after_rating"-"pitch_rating_events"."before_rating"="pitch_rating_events"."delta")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pitch_player_game` ON `pitch_rating_events` (`player_id`,`games_before`);--> statement-breakpoint
CREATE TABLE `pitch_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`reporter_id` text NOT NULL,
	`target_id` text NOT NULL,
	`reason` text NOT NULL,
	`details` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`reviewed_at` integer,
	`reviewer_id` text,
	FOREIGN KEY (`room_id`) REFERENCES `pitch_rooms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reporter_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `pitch_reports_review` ON `pitch_reports` (`status`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `pitch_report_once` ON `pitch_reports` (`room_id`,`reporter_id`,`target_id`);--> statement-breakpoint
CREATE TABLE `pitch_responses` (
	`room_id` text NOT NULL,
	`player_id` text NOT NULL,
	`phase` integer NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`room_id`, `player_id`, `phase`),
	FOREIGN KEY (`room_id`) REFERENCES `pitch_rooms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pitch_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`band` text NOT NULL,
	`scenario_id` text NOT NULL,
	`a_id` text NOT NULL,
	`b_id` text NOT NULL,
	`started_at` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`result` text,
	`resolution_token` text,
	`finished_at` integer,
	FOREIGN KEY (`a_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`b_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "pitch_room_players" CHECK("pitch_rooms"."a_id" != "pitch_rooms"."b_id"),
	CONSTRAINT "pitch_room_status" CHECK("pitch_rooms"."status" IN ('active','finished','cancelled'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pitch_rooms_code_unique` ON `pitch_rooms` (`code`);--> statement-breakpoint
CREATE TABLE `pitch_seats` (
	`room_id` text NOT NULL,
	`player_id` text NOT NULL,
	`role` text NOT NULL,
	`slot` integer NOT NULL,
	`last_seen` integer NOT NULL,
	`left_at` integer,
	PRIMARY KEY(`room_id`, `player_id`),
	FOREIGN KEY (`room_id`) REFERENCES `pitch_rooms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "pitch_seat_role" CHECK(("pitch_seats"."role"='contestant' AND "pitch_seats"."slot" IN (0,1)) OR ("pitch_seats"."role"='judge' AND "pitch_seats"."slot" BETWEEN 2 AND 4))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pitch_seat_slot` ON `pitch_seats` (`room_id`,`slot`);--> statement-breakpoint
CREATE INDEX `pitch_seat_player` ON `pitch_seats` (`player_id`);--> statement-breakpoint
CREATE TABLE `pitch_signals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`room_id` text NOT NULL,
	`sender_id` text NOT NULL,
	`target_id` text NOT NULL,
	`kind` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `pitch_rooms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sender_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `pitch_signal_receive` ON `pitch_signals` (`room_id`,`target_id`,`id`);