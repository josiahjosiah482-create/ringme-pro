CREATE TABLE `device_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`token` varchar(512) NOT NULL,
	`platform` enum('ios','android','web') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `device_tokens_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `call_logs` ADD `twilioCallSid` varchar(64);--> statement-breakpoint
ALTER TABLE `messages` ADD `twilioSid` varchar(64);