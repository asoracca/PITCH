CREATE TABLE `player_ratings` (
	`player_id` text PRIMARY KEY NOT NULL,
	`rating` integer DEFAULT 1000 NOT NULL,
	`games` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "rating_floor" CHECK("player_ratings"."rating" >= 100),
	CONSTRAINT "rated_games_nonnegative" CHECK("player_ratings"."games" >= 0)
);
--> statement-breakpoint
CREATE INDEX `idx_player_ratings_ranking` ON `player_ratings` (`rating`,`games`);--> statement-breakpoint
CREATE TABLE `rating_events` (
	`room_id` text NOT NULL,
	`player_id` text NOT NULL,
	`opponent_id` text NOT NULL,
	`opponent_rating` integer NOT NULL,
	`before_rating` integer NOT NULL,
	`after_rating` integer NOT NULL,
	`delta` integer NOT NULL,
	`games_before` integer NOT NULL,
	`result` text NOT NULL,
	`expected_score` real NOT NULL,
	`k` integer NOT NULL,
	`version` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`room_id`, `player_id`),
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`opponent_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "rating_event_floor" CHECK("rating_events"."before_rating" >= 100 AND "rating_events"."after_rating" >= 100 AND "rating_events"."opponent_rating" >= 100),
	CONSTRAINT "rating_event_delta" CHECK("rating_events"."after_rating" - "rating_events"."before_rating" = "rating_events"."delta"),
	CONSTRAINT "rating_event_result" CHECK("rating_events"."result" IN ('win','loss','draw')),
	CONSTRAINT "rating_event_expected" CHECK("rating_events"."expected_score" BETWEEN 0 AND 1),
	CONSTRAINT "rating_event_opponent" CHECK("rating_events"."player_id" != "rating_events"."opponent_id"),
	CONSTRAINT "rating_event_games" CHECK("rating_events"."games_before" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_rating_events_player_game` ON `rating_events` (`player_id`,`games_before`);