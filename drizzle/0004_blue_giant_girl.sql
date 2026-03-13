CREATE TABLE `blocked_numbers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`number` varchar(32) NOT NULL,
	`label` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `blocked_numbers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `porting_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`number` varchar(32) NOT NULL,
	`carrier` varchar(128) NOT NULL,
	`accountPin` varchar(32),
	`billingAddress` text,
	`status` enum('pending','approved','completed','rejected') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `porting_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `spam_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`number` varchar(32) NOT NULL,
	`reportCount` int NOT NULL DEFAULT 1,
	`lastReportedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `spam_reports_id` PRIMARY KEY(`id`),
	CONSTRAINT `spam_reports_number_unique` UNIQUE(`number`)
);
--> statement-breakpoint
CREATE TABLE `user_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`dndEnabled` boolean NOT NULL DEFAULT false,
	`dndFrom` varchar(5) NOT NULL DEFAULT '22:00',
	`dndUntil` varchar(5) NOT NULL DEFAULT '08:00',
	`voicemailGreetingUrl` varchar(512),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_settings_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `call_logs` ADD `isRecorded` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `call_logs` ADD `recordingUrl` varchar(512);--> statement-breakpoint
ALTER TABLE `call_logs` ADD `recordingDuration` int;--> statement-breakpoint
ALTER TABLE `call_logs` ADD `spamScore` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `conversations` ADD `isGroup` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `conversations` ADD `groupName` varchar(128);--> statement-breakpoint
ALTER TABLE `messages` ADD `mediaUrl` varchar(512);--> statement-breakpoint
ALTER TABLE `phone_numbers` ADD `forwardTo` varchar(32);--> statement-breakpoint
ALTER TABLE `phone_numbers` ADD `mode` enum('active','forward','voicemail_only') DEFAULT 'active' NOT NULL;