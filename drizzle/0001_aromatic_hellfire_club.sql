ALTER TABLE `account` ADD `refresh_token_expires_at` integer;--> statement-breakpoint
ALTER TABLE `account` ADD `scope` text;--> statement-breakpoint
ALTER TABLE `account` ADD `token_type` text;--> statement-breakpoint
ALTER TABLE `account` ADD `password` text;