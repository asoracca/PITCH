CREATE TABLE `arguments` (
	`room_id` text NOT NULL,
	`player_id` text NOT NULL,
	`round` integer NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`room_id`, `player_id`, `round`),
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "argument_valid_round" CHECK("arguments"."round" BETWEEN 0 AND 2),
	CONSTRAINT "argument_content_length" CHECK(length("arguments"."content") BETWEEN 1 AND 600)
);
--> statement-breakpoint
CREATE TABLE `judge_rewards` (
	`room_id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`earned_at` integer NOT NULL,
	`consumed_by` text,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`consumed_by`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_judge_rewards_available` ON `judge_rewards` (`player_id`,`consumed_by`,`earned_at`);--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `queue_entries` (
	`player_id` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`format` text NOT NULL,
	`joined_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`room_id` text,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "queue_role" CHECK("queue_entries"."role" IN ('judge','contestant','mixed'))
);
--> statement-breakpoint
CREATE INDEX `idx_queue_match` ON `queue_entries` (`format`,`room_id`,`expires_at`,`priority`,`joined_at`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`hits` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_rate_limits_expires` ON `rate_limits` (`expires_at`);--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`host_id` text NOT NULL,
	`guest_id` text,
	`judge_id` text,
	`kind` text DEFAULT 'private' NOT NULL,
	`format` text DEFAULT 'classic' NOT NULL,
	`host_for` integer NOT NULL,
	`topic` text NOT NULL,
	`status` text DEFAULT 'waiting' NOT NULL,
	`round` integer DEFAULT 0 NOT NULL,
	`deadline` integer,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`rematch_of` text,
	`judge_lease` text,
	`judge_until` integer,
	`verdict` text,
	`finished_at` integer,
	FOREIGN KEY (`host_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`guest_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`judge_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "room_distinct_players" CHECK("rooms"."guest_id" IS NULL OR "rooms"."guest_id" != "rooms"."host_id"),
	CONSTRAINT "room_distinct_judge" CHECK("rooms"."judge_id" IS NULL OR ("rooms"."judge_id" != "rooms"."host_id" AND "rooms"."judge_id" != "rooms"."guest_id")),
	CONSTRAINT "room_valid_status" CHECK("rooms"."status" IN ('waiting','active','judging','finished','cancelled')),
	CONSTRAINT "room_valid_round" CHECK("rooms"."round" BETWEEN 0 AND 2),
	CONSTRAINT "room_valid_side" CHECK("rooms"."host_for" IN (0,1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_rooms_code` ON `rooms` (`code`);--> statement-breakpoint
CREATE INDEX `idx_rooms_host_created` ON `rooms` (`host_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_rooms_guest_created` ON `rooms` (`guest_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `score_events` (
	`room_id` text NOT NULL,
	`player_id` text NOT NULL,
	`score` integer NOT NULL,
	`result` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`room_id`, `player_id`),
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "score_bounds" CHECK("score_events"."score" BETWEEN 0 AND 100),
	CONSTRAINT "score_result" CHECK("score_events"."result" IN ('win','loss','draw'))
);
--> statement-breakpoint
CREATE INDEX `idx_score_events_player` ON `score_events` (`player_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_expires` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `voice_signals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`room_id` text NOT NULL,
	`sender_id` text NOT NULL,
	`target_id` text NOT NULL,
	`kind` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sender_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_voice_signals_room_target_id` ON `voice_signals` (`room_id`,`target_id`,`id`);