CREATE TABLE `daily_performance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`date` varchar(10) NOT NULL,
	`totalPnl` decimal(10,2) NOT NULL DEFAULT '0',
	`totalPnlPoints` decimal(10,2) NOT NULL DEFAULT '0',
	`tradesCount` int NOT NULL DEFAULT 0,
	`winsCount` int NOT NULL DEFAULT 0,
	`lossesCount` int NOT NULL DEFAULT 0,
	`maxDrawdown` decimal(10,2) NOT NULL DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `daily_performance_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `oco_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`stopLossPoints` int NOT NULL DEFAULT 150,
	`takeProfitPoints` int NOT NULL DEFAULT 250,
	`breakevenTriggerPoints` int NOT NULL DEFAULT 100,
	`trailingStopPoints` int NOT NULL DEFAULT 50,
	`trailingStopTriggerPoints` int NOT NULL DEFAULT 150,
	`defaultContracts` int NOT NULL DEFAULT 5,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `oco_configs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trades` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`symbol` varchar(20) NOT NULL DEFAULT 'WIN',
	`side` enum('buy','sell') NOT NULL,
	`contracts` int NOT NULL,
	`entryPrice` decimal(10,2) NOT NULL,
	`exitPrice` decimal(10,2),
	`stopLoss` decimal(10,2),
	`takeProfit` decimal(10,2),
	`pnl` decimal(10,2),
	`pnlPoints` decimal(10,2),
	`status` enum('open','closed','stopped','target') NOT NULL DEFAULT 'open',
	`notes` text,
	`entryAt` timestamp NOT NULL DEFAULT (now()),
	`exitAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trades_id` PRIMARY KEY(`id`)
);
