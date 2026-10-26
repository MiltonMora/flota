PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_user_vehicles` (
	`user_id` text NOT NULL,
	`vehicle_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`user_id`, `vehicle_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT OR IGNORE INTO `__new_user_vehicles`("user_id", "vehicle_id", "created_at") SELECT "user_id", "vehicle_id", "created_at" FROM `user_vehicles`;--> statement-breakpoint
DROP TABLE `user_vehicles`;--> statement-breakpoint
ALTER TABLE `__new_user_vehicles` RENAME TO `user_vehicles`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `transactions` ADD `notes` text;--> statement-breakpoint
CREATE INDEX `transactions_vehicle_date_idx` ON `transactions` (`vehicle_id`,`date`);