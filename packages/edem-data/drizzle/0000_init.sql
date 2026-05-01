CREATE TABLE `collections` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`parent_id` text,
	`template_id` text,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`icon` text,
	`singleton` integer DEFAULT false,
	`system` integer DEFAULT false,
	`schema_version` integer DEFAULT 1,
	`default_sort_field` text,
	`default_sort_dir` text DEFAULT 'asc',
	`meta` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `collections_slug_unique` ON `collections` (`slug`);--> statement-breakpoint
CREATE TABLE `field_migrations` (
	`id` text PRIMARY KEY NOT NULL,
	`collection_id` text NOT NULL,
	`schema_version` integer NOT NULL,
	`operation` text NOT NULL,
	`field_name` text NOT NULL,
	`old_field_name` text,
	`old_field_type` text,
	`new_field_type` text,
	`default_value` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_field_migrations_collection` ON `field_migrations` (`collection_id`);--> statement-breakpoint
CREATE TABLE `fields` (
	`id` text PRIMARY KEY NOT NULL,
	`collection_id` text NOT NULL,
	`name` text NOT NULL,
	`labels` text,
	`type` text NOT NULL,
	`interface` text,
	`interface_options` text,
	`display` text,
	`display_options` text,
	`group_name` text,
	`required` integer DEFAULT false,
	`hidden` integer DEFAULT false,
	`readonly` integer DEFAULT false,
	`system` integer DEFAULT false,
	`indexed` integer DEFAULT false,
	`special` text,
	`computed` integer DEFAULT false,
	`computed_deps` text,
	`default_value` text,
	`validation` text,
	`meta` text,
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `file_thumbnails` (
	`id` text PRIMARY KEY NOT NULL,
	`file_hash` text NOT NULL,
	`size_name` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`format` text DEFAULT 'webp',
	`storage_path` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`file_hash`) REFERENCES `files`(`hash`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_file_thumbnails_hash` ON `file_thumbnails` (`file_hash`);--> statement-breakpoint
CREATE TABLE `files` (
	`hash` text PRIMARY KEY NOT NULL,
	`original_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`storage_path` text NOT NULL,
	`ref_count` integer DEFAULT 1,
	`width` integer,
	`height` integer,
	`duration` real,
	`frame_rate` real,
	`video_codec` text,
	`audio_codec` text,
	`bitrate` integer,
	`sample_rate` integer,
	`channels` integer,
	`orientation` integer,
	`color_space` text,
	`metadata` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `item_files` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`field_id` text,
	`file_hash` text NOT NULL,
	`sort_order` integer DEFAULT 0,
	`metadata` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`file_hash`) REFERENCES `files`(`hash`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_item_files_item` ON `item_files` (`item_id`);--> statement-breakpoint
CREATE TABLE `item_locks` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`locked_by` text NOT NULL,
	`reason` text,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `item_locks_item_id_unique` ON `item_locks` (`item_id`);--> statement-breakpoint
CREATE TABLE `item_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`version` integer NOT NULL,
	`data` text NOT NULL,
	`source` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_item_versions_item` ON `item_versions` (`item_id`);--> statement-breakpoint
CREATE TABLE `items` (
	`id` text PRIMARY KEY NOT NULL,
	`collection_id` text NOT NULL,
	`schema_version` integer DEFAULT 1,
	`source` text,
	`data` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_items_collection` ON `items` (`collection_id`);--> statement-breakpoint
CREATE INDEX `idx_items_deleted` ON `items` (`deleted_at`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`icon` text,
	`color` text,
	`is_default` integer DEFAULT false,
	`sort_order` integer DEFAULT 0,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_slug_unique` ON `projects` (`slug`);--> statement-breakpoint
CREATE TABLE `relations` (
	`id` text PRIMARY KEY NOT NULL,
	`source_item_id` text NOT NULL,
	`source_field_id` text NOT NULL,
	`target_item_id` text NOT NULL,
	`target_collection_id` text NOT NULL,
	`sort_order` integer DEFAULT 0,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`source_item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_field_id`) REFERENCES `fields`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_relations_source` ON `relations` (`source_item_id`,`source_field_id`);--> statement-breakpoint
CREATE INDEX `idx_relations_target` ON `relations` (`target_item_id`);--> statement-breakpoint
CREATE TABLE `template_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`template_type` text NOT NULL,
	`template_id` text NOT NULL,
	`tag` text NOT NULL,
	FOREIGN KEY (`template_id`) REFERENCES `templates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_template_tags_tag` ON `template_tags` (`tag`);--> statement-breakpoint
CREATE TABLE `templates` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`source` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`icon` text,
	`color` text,
	`preview` text,
	`version` integer DEFAULT 1,
	`author` text,
	`config` text NOT NULL,
	`created_at` integer NOT NULL
);
