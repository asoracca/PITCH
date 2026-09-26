CREATE TABLE `pitch_peer_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`author_id` text NOT NULL,
	`target_id` text NOT NULL,
	`clarity` integer NOT NULL,
	`persuasiveness` integer NOT NULL,
	`composure` integer NOT NULL,
	`tip` text NOT NULL,
	`rating` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `pitch_rooms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "pitch_peer_feedback_target" CHECK("pitch_peer_feedback"."author_id" != "pitch_peer_feedback"."target_id"),
	CONSTRAINT "pitch_peer_feedback_scores" CHECK("pitch_peer_feedback"."clarity" BETWEEN 1 AND 5 AND "pitch_peer_feedback"."persuasiveness" BETWEEN 1 AND 5 AND "pitch_peer_feedback"."composure" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pitch_peer_feedback_once` ON `pitch_peer_feedback` (`room_id`,`author_id`);--> statement-breakpoint
ALTER TABLE `pitch_queue` ADD `allow_peer` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `pitch_rooms` ADD `judging_mode` text DEFAULT 'judged' NOT NULL;