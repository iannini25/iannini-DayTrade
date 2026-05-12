ALTER TABLE `user_settings` ADD `tradingPaused` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `enableLiveTrading` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `requireOrderConfirmation` boolean DEFAULT true NOT NULL;