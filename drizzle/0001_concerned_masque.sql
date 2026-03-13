CREATE TABLE `call_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`contactName` varchar(128),
	`contactNumber` varchar(32) NOT NULL,
	`direction` enum('inbound','outbound') NOT NULL,
	`status` enum('completed','missed','rejected') NOT NULL,
	`durationSeconds` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `call_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`contactName` varchar(128),
	`contactNumber` varchar(32) NOT NULL,
	`lastMessage` text,
	`lastMessageAt` timestamp NOT NULL DEFAULT (now()),
	`unreadCount` int NOT NULL DEFAULT 0,
	`isBurner` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`userId` int NOT NULL,
	`text` text NOT NULL,
	`isMe` boolean NOT NULL DEFAULT true,
	`status` enum('sent','delivered','read') NOT NULL DEFAULT 'sent',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `phone_numbers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`number` varchar(32) NOT NULL,
	`countryCode` varchar(4) NOT NULL DEFAULT 'US',
	`isPrimary` boolean NOT NULL DEFAULT false,
	`isBurner` boolean NOT NULL DEFAULT false,
	`burnerName` varchar(64),
	`burnerEmoji` varchar(8),
	`burnerColor` varchar(16),
	`expiresAt` timestamp,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `phone_numbers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `subscriptionTier` enum('free','pro','max') DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `avatarColor` varchar(16);