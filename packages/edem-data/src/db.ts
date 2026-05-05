import { mkdirSync } from "fs"
import { dirname } from "path"
import { Database } from "bun:sqlite"
import { drizzle } from "drizzle-orm/bun-sqlite"
import * as schema from "./schema"

export type DrizzleDB = ReturnType<typeof drizzle<typeof schema>>

export interface DataEngine {
  db: DrizzleDB
  sqlite: Database
}

const INIT_SQL = `CREATE TABLE IF NOT EXISTS "collections" (
	"id" text PRIMARY KEY NOT NULL,
	"parent_id" text,
	"template_id" text,
	"name" text NOT NULL,
	"labels" text,
	"description" text,
	"icon" text,
	"singleton" integer DEFAULT false,
	"system" integer DEFAULT false,
	"schema_version" integer DEFAULT 1,
	"default_sort_field" text,
	"default_sort_dir" text DEFAULT 'asc',
	"meta" text,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	"deleted_at" integer
);
CREATE TABLE IF NOT EXISTS "fields" (
	"id" text PRIMARY KEY NOT NULL,
	"collection_id" text NOT NULL,
	"name" text NOT NULL,
	"labels" text,
	"type" text NOT NULL,
	"interface" text,
	"interface_options" text,
	"display" text,
	"display_options" text,
	"group_name" text,
	"required" integer DEFAULT false,
	"hidden" integer DEFAULT false,
	"readonly" integer DEFAULT false,
	"system" integer DEFAULT false,
	"indexed" integer DEFAULT false,
	"special" text,
	"computed" integer DEFAULT false,
	"computed_deps" text,
	"default_value" text,
	"validation" text,
	"meta" text,
	FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON UPDATE no action ON DELETE cascade
);
CREATE TABLE IF NOT EXISTS "items" (
	"id" text PRIMARY KEY NOT NULL,
	"collection_id" text NOT NULL,
	"schema_version" integer DEFAULT 1,
	"source" text,
	"data" text NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	"deleted_at" integer,
	FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS "idx_items_collection" ON "items" ("collection_id");
CREATE INDEX IF NOT EXISTS "idx_items_deleted" ON "items" ("deleted_at");
CREATE TABLE IF NOT EXISTS "relations" (
	"id" text PRIMARY KEY NOT NULL,
	"source_item_id" text NOT NULL,
	"source_field_id" text NOT NULL,
	"target_item_id" text NOT NULL,
	"target_collection_id" text NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" integer NOT NULL,
	FOREIGN KEY ("source_item_id") REFERENCES "items"("id") ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY ("source_field_id") REFERENCES "fields"("id") ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY ("target_item_id") REFERENCES "items"("id") ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY ("target_collection_id") REFERENCES "collections"("id") ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS "idx_relations_source" ON "relations" ("source_item_id","source_field_id");
CREATE INDEX IF NOT EXISTS "idx_relations_target" ON "relations" ("target_item_id");
CREATE TABLE IF NOT EXISTS "item_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"item_id" text NOT NULL,
	"version" integer NOT NULL,
	"data" text NOT NULL,
	"source" text,
	"created_at" integer NOT NULL,
	FOREIGN KEY ("item_id") REFERENCES "items"("id") ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS "idx_item_versions_item" ON "item_versions" ("item_id");
CREATE TABLE IF NOT EXISTS "item_locks" (
	"id" text PRIMARY KEY NOT NULL,
	"item_id" text NOT NULL,
	"locked_by" text NOT NULL,
	"reason" text,
	"expires_at" integer NOT NULL,
	"created_at" integer NOT NULL,
	FOREIGN KEY ("item_id") REFERENCES "items"("id") ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX IF NOT EXISTS "item_locks_item_id_unique" ON "item_locks" ("item_id");
CREATE TABLE IF NOT EXISTS "files" (
	"hash" text PRIMARY KEY NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"storage_path" text NOT NULL,
	"ref_count" integer DEFAULT 1,
	"width" integer,
	"height" integer,
	"duration" real,
	"frame_rate" real,
	"video_codec" text,
	"audio_codec" text,
	"bitrate" integer,
	"sample_rate" integer,
	"channels" integer,
	"orientation" integer,
	"color_space" text,
	"metadata" text,
	"created_at" integer NOT NULL
);
CREATE TABLE IF NOT EXISTS "item_files" (
	"id" text PRIMARY KEY NOT NULL,
	"item_id" text NOT NULL,
	"field_id" text,
	"file_hash" text NOT NULL,
	"sort_order" integer DEFAULT 0,
	"metadata" text,
	"created_at" integer NOT NULL,
	FOREIGN KEY ("item_id") REFERENCES "items"("id") ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY ("file_hash") REFERENCES "files"("hash") ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS "idx_item_files_item" ON "item_files" ("item_id");
CREATE TABLE IF NOT EXISTS "file_thumbnails" (
	"id" text PRIMARY KEY NOT NULL,
	"file_hash" text NOT NULL,
	"size_name" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"format" text DEFAULT 'webp',
	"storage_path" text NOT NULL,
	"created_at" integer NOT NULL,
	FOREIGN KEY ("file_hash") REFERENCES "files"("hash") ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS "idx_file_thumbnails_hash" ON "file_thumbnails" ("file_hash");
CREATE TABLE IF NOT EXISTS "field_migrations" (
	"id" text PRIMARY KEY NOT NULL,
	"collection_id" text NOT NULL,
	"schema_version" integer NOT NULL,
	"operation" text NOT NULL,
	"field_name" text NOT NULL,
	"old_field_name" text,
	"old_field_type" text,
	"new_field_type" text,
	"default_value" text,
	"created_at" integer NOT NULL,
	FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS "idx_field_migrations_collection" ON "field_migrations" ("collection_id");
CREATE TABLE IF NOT EXISTS "templates" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"source" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"icon" text,
	"color" text,
	"preview" text,
	"version" integer DEFAULT 1,
	"author" text,
	"config" text NOT NULL,
	"created_at" integer NOT NULL
);
CREATE TABLE IF NOT EXISTS "template_tags" (
	"id" text PRIMARY KEY NOT NULL,
	"template_type" text NOT NULL,
	"template_id" text NOT NULL,
	"tag" text NOT NULL,
	FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS "idx_template_tags_tag" ON "template_tags" ("tag");`

export interface DataEngineOptions {
  dbPath: string
}

let sharedEngine: DataEngine | null = null

export function createDataEngine(options: DataEngineOptions): DataEngine {
  if (sharedEngine) return sharedEngine
  const { dbPath } = options
  mkdirSync(dirname(dbPath), { recursive: true })
  const sqlite = new Database(dbPath)

  sqlite.exec("PRAGMA journal_mode = WAL")
  sqlite.exec("PRAGMA foreign_keys = ON")

  sqlite.exec(INIT_SQL)

  try {
    sqlite.exec('ALTER TABLE "collections" ADD COLUMN "labels" text')
  } catch {
    // column already exists
  }

  const db = drizzle(sqlite, { schema })
  sharedEngine = { db, sqlite }
  return sharedEngine
}

export function resetDataEngine() {
  if (sharedEngine) {
    sharedEngine.sqlite.close()
    sharedEngine = null
  }
}
