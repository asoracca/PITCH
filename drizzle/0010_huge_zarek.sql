CREATE TABLE `pitch_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sender_id` text NOT NULL,
	`recipient_id` text NOT NULL,
	`request_id` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`sender_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recipient_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "pitch_message_other" CHECK("pitch_messages"."sender_id" != "pitch_messages"."recipient_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pitch_message_once` ON `pitch_messages` (`sender_id`,`request_id`);--> statement-breakpoint
CREATE INDEX `pitch_message_pair` ON `pitch_messages` (`sender_id`,`recipient_id`,`id`);