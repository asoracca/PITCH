CREATE TABLE `pitch_follows` (
	`follower_id` text NOT NULL,
	`followed_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`follower_id`, `followed_id`),
	FOREIGN KEY (`follower_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`followed_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "pitch_no_self_follow" CHECK("pitch_follows"."follower_id" != "pitch_follows"."followed_id")
);
--> statement-breakpoint
CREATE INDEX `pitch_followed` ON `pitch_follows` (`followed_id`);