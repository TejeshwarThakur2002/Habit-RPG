CREATE TABLE `boss_weeks` (
	`id` text PRIMARY KEY NOT NULL,
	`party_id` text NOT NULL,
	`week_start` text NOT NULL,
	`boss_key` text NOT NULL,
	`max_hp` integer NOT NULL,
	`current_hp` integer NOT NULL,
	`defeated_at` text
);
--> statement-breakpoint
CREATE TABLE `characters` (
	`user_id` text PRIMARY KEY NOT NULL,
	`level` integer DEFAULT 1 NOT NULL,
	`xp_in_level` integer DEFAULT 0 NOT NULL,
	`hp` integer DEFAULT 44 NOT NULL,
	`gold` integer DEFAULT 0 NOT NULL,
	`current_streak` integer DEFAULT 0 NOT NULL,
	`longest_streak` integer DEFAULT 0 NOT NULL,
	`last_closed_date` text
);
--> statement-breakpoint
CREATE TABLE `completions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`habit_id` text NOT NULL,
	`local_date` text NOT NULL,
	`completed_at` text NOT NULL,
	`category` text NOT NULL,
	`xp_awarded` integer NOT NULL,
	`gold_awarded` integer NOT NULL,
	`boss_damage` integer NOT NULL,
	`is_late` integer DEFAULT false NOT NULL,
	`undone_at` text,
	`server_seq` integer,
	FOREIGN KEY (`habit_id`) REFERENCES `habits`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_completion_per_habit_day` ON `completions` (`habit_id`,`local_date`) WHERE "completions"."undone_at" is null;--> statement-breakpoint
CREATE INDEX `completions_user_date` ON `completions` (`user_id`,`local_date`);--> statement-breakpoint
CREATE TABLE `day_closures` (
	`user_id` text NOT NULL,
	`local_date` text NOT NULL,
	`closed_at` text NOT NULL,
	`hp_lost` integer NOT NULL,
	`missed` text NOT NULL,
	PRIMARY KEY(`user_id`, `local_date`)
);
--> statement-breakpoint
CREATE TABLE `habits` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`difficulty` text NOT NULL,
	`category` text DEFAULT 'none' NOT NULL,
	`weekdays` integer DEFAULT 127 NOT NULL,
	`reminder_time` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_date` text NOT NULL,
	`archived_at` text,
	`deleted_at` text,
	`client_updated_at` text NOT NULL,
	`server_seq` integer
);
--> statement-breakpoint
CREATE INDEX `habits_user_order` ON `habits` (`user_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `inventory` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`item_id` text NOT NULL,
	`equipped` integer DEFAULT false NOT NULL,
	`purchased_at` text NOT NULL,
	`server_seq` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_user_item` ON `inventory` (`user_id`,`item_id`);--> statement-breakpoint
CREATE TABLE `outbox` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`table_name` text NOT NULL,
	`row_id` text NOT NULL,
	`op` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text
);
--> statement-breakpoint
CREATE TABLE `parties` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`timezone` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `party_events` (
	`id` text PRIMARY KEY NOT NULL,
	`party_id` text NOT NULL,
	`boss_week_id` text,
	`user_id` text,
	`kind` text NOT NULL,
	`amount` integer,
	`habit_name` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `party_events_recent` ON `party_events` (`party_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `party_members` (
	`party_id` text NOT NULL,
	`user_id` text NOT NULL,
	`hero_name` text NOT NULL,
	`class` text NOT NULL,
	`joined_at` text NOT NULL,
	`left_at` text,
	PRIMARY KEY(`party_id`, `user_id`)
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`hero_name` text NOT NULL,
	`class` text NOT NULL,
	`timezone` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`reduce_motion` text DEFAULT 'system' NOT NULL,
	`onboarding_done` integer DEFAULT false NOT NULL,
	`demo_mode` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`cursor` integer DEFAULT 0 NOT NULL,
	`last_sync_at` text,
	`device_id` text NOT NULL,
	`user_id` text
);
