ALTER TABLE `transactions` ADD `category` text;--> statement-breakpoint
CREATE INDEX `transactions_category_idx` ON `transactions` (`category`);