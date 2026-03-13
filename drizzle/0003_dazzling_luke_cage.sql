CREATE TABLE `contacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(128) NOT NULL,
	`number` varchar(32) NOT NULL,
	`avatarColor` varchar(16),
	`isFavorite` boolean NOT NULL DEFAULT false,
	`isDeviceContact` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `voicemails` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`callerNumber` varchar(32) NOT NULL,
	`callerName` varchar(128),
	`recordingUrl` text,
	`recordingSid` varchar(64),
	`durationSeconds` int NOT NULL DEFAULT 0,
	`transcript` text,
	`isListened` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `voicemails_id` PRIMARY KEY(`id`)
);
