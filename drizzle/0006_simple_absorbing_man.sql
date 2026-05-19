ALTER TABLE `user_settings` ADD `breakevenTriggerPoints` int DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `maxContractsLimit` int DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `marginLimitBrl` decimal(10,2) DEFAULT '5000' NOT NULL;