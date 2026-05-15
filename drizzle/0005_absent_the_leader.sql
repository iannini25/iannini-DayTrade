CREATE TABLE `educational_content` (
	`id` int AUTO_INCREMENT NOT NULL,
	`topic` varchar(100) NOT NULL,
	`content` text NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `educational_content_id` PRIMARY KEY(`id`),
	CONSTRAINT `educational_content_topic_unique` UNIQUE(`topic`)
);
