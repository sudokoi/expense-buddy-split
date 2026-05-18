CREATE TABLE `group_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`max_uses` integer,
	`used_count` integer DEFAULT 0 NOT NULL,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `group_invites_token_hash_unique` ON `group_invites` (`token_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `group_invites_token_hash_idx` ON `group_invites` (`token_hash`);--> statement-breakpoint
CREATE TABLE `group_members` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`joined_at` integer NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `group_members_group_user_idx` ON `group_members` (`group_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `group_slug_history` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`slug` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `group_slug_history_slug_unique` ON `group_slug_history` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `group_slug_history_slug_idx` ON `group_slug_history` (`slug`);--> statement-breakpoint
CREATE TABLE `groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`currency_code` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `groups_slug_unique` ON `groups` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `groups_slug_idx` ON `groups` (`slug`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`github_user_id` integer NOT NULL,
	`user_login` text NOT NULL,
	`display_name` text NOT NULL,
	`avatar_url` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_github_user_id_unique` ON `users` (`github_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_github_user_id_idx` ON `users` (`github_user_id`);