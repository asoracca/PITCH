CREATE TABLE `pitch_chat` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`room_id` text NOT NULL,
	`player_id` text NOT NULL,
	`request_id` text NOT NULL,
	`kind` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `pitch_rooms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "pitch_chat_kind" CHECK("pitch_chat"."kind" IN ('message','reaction'))
);
--> statement-breakpoint
CREATE INDEX `pitch_chat_room` ON `pitch_chat` (`room_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `pitch_chat_once` ON `pitch_chat` (`room_id`,`player_id`,`request_id`);--> statement-breakpoint
ALTER TABLE `pitch_profiles` ADD `avatar_json` text;--> statement-breakpoint
ALTER TABLE `pitch_queue` ADD `category` text DEFAULT 'all' NOT NULL;