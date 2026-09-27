CREATE TABLE `pitch_friendships` (
	`player_a` text NOT NULL,
	`player_b` text NOT NULL,
	`requester_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`player_a`, `player_b`),
	FOREIGN KEY (`player_a`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_b`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`requester_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "pitch_friend_pair" CHECK("pitch_friendships"."player_a" < "pitch_friendships"."player_b"),
	CONSTRAINT "pitch_friend_requester" CHECK("pitch_friendships"."requester_id" IN ("pitch_friendships"."player_a","pitch_friendships"."player_b")),
	CONSTRAINT "pitch_friend_status" CHECK("pitch_friendships"."status" IN ('pending','accepted'))
);
--> statement-breakpoint
CREATE INDEX `pitch_friends_recipient` ON `pitch_friendships` (`player_b`);