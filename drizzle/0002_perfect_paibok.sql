CREATE TABLE `inter_credentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`clientId` varchar(255),
	`clientSecretHash` varchar(255),
	`certFingerprint` varchar(255),
	`accountNumber` varchar(50),
	`environment` enum('sandbox','production') NOT NULL DEFAULT 'sandbox',
	`status` enum('not_configured','pending','active','error') NOT NULL DEFAULT 'not_configured',
	`lastTestedAt` timestamp,
	`lastError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inter_credentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `inter_credentials_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `predictions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`symbol` varchar(20) NOT NULL DEFAULT 'WIN',
	`signalType` enum('buy','sell','neutral','avoid') NOT NULL,
	`confidence` int NOT NULL DEFAULT 50,
	`entryZoneLow` decimal(10,2),
	`entryZoneHigh` decimal(10,2),
	`stopLoss` decimal(10,2),
	`takeProfit` decimal(10,2),
	`reasoning` text,
	`marketContext` text,
	`riskLevel` enum('low','medium','high') NOT NULL DEFAULT 'medium',
	`status` enum('pending','executed','ignored','won','lost','expired') NOT NULL DEFAULT 'pending',
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `predictions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`preferredContracts` int NOT NULL DEFAULT 5,
	`riskProfile` enum('conservative','moderate','aggressive') NOT NULL DEFAULT 'moderate',
	`dailyGoal` decimal(10,2) NOT NULL DEFAULT '2000',
	`dailyLimit` decimal(10,2) NOT NULL DEFAULT '1000',
	`stopLossPoints` int NOT NULL DEFAULT 150,
	`takeProfitPoints` int NOT NULL DEFAULT 250,
	`enableAiPredictions` boolean NOT NULL DEFAULT true,
	`enableSoundAlerts` boolean NOT NULL DEFAULT true,
	`enableAutoBreakeven` boolean NOT NULL DEFAULT true,
	`pauseAfterLosses` int NOT NULL DEFAULT 3,
	`timezone` varchar(50) NOT NULL DEFAULT 'America/Sao_Paulo',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_settings_userId_unique` UNIQUE(`userId`)
);
