PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_party_members` (
	`party_id` text NOT NULL,
	`user_id` text NOT NULL,
	`hero_name` text,
	`class` text,
	`joined_at` text NOT NULL,
	`left_at` text,
	`damage` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`party_id`, `user_id`)
);
--> statement-breakpoint
INSERT INTO `__new_party_members`("party_id", "user_id", "hero_name", "class", "joined_at", "left_at") SELECT "party_id", "user_id", "hero_name", "class", "joined_at", "left_at" FROM `party_members`;--> statement-breakpoint
DROP TABLE `party_members`;--> statement-breakpoint
ALTER TABLE `__new_party_members` RENAME TO `party_members`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `boss_weeks` ADD `claimed` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `parties` ADD `fetched_at` text;