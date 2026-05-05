import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core"

// ── Collections ───────────────────────────────────────────────────────────────

export const collections = sqliteTable("collections", {
  id: text("id").primaryKey(),
  parent_id: text("parent_id"),
  template_id: text("template_id"),
  name: text("name").notNull(),
  labels: text("labels"), // JSON i18n
  description: text("description"),
  icon: text("icon"),
  singleton: integer("singleton", { mode: "boolean" }).default(false),
  system: integer("system", { mode: "boolean" }).default(false),
  schema_version: integer("schema_version").default(1),
  default_sort_field: text("default_sort_field"),
  default_sort_dir: text("default_sort_dir", { enum: ["asc", "desc"] }).default("asc"),
  meta: text("meta"), // JSON
  created_at: integer("created_at").notNull(),
  updated_at: integer("updated_at").notNull(),
  deleted_at: integer("deleted_at"),
})

// ── Fields ────────────────────────────────────────────────────────────────────

export const fields = sqliteTable("fields", {
  id: text("id").primaryKey(),
  collection_id: text("collection_id")
    .notNull()
    .references(() => collections.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  labels: text("labels"), // JSON i18n
  type: text("type").notNull(),
  interface: text("interface"),
  interface_options: text("interface_options"), // JSON
  display: text("display"),
  display_options: text("display_options"), // JSON
  group_name: text("group_name"),
  required: integer("required", { mode: "boolean" }).default(false),
  hidden: integer("hidden", { mode: "boolean" }).default(false),
  readonly: integer("readonly", { mode: "boolean" }).default(false),
  system: integer("system", { mode: "boolean" }).default(false),
  indexed: integer("indexed", { mode: "boolean" }).default(false),
  special: text("special"),
  computed: integer("computed", { mode: "boolean" }).default(false),
  computed_deps: text("computed_deps"), // JSON array
  default_value: text("default_value"),
  validation: text("validation"), // JSON
  meta: text("meta"), // JSON
})

// ── Items ─────────────────────────────────────────────────────────────────────

export const items = sqliteTable(
  "items",
  {
    id: text("id").primaryKey(),
    collection_id: text("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    schema_version: integer("schema_version").default(1),
    source: text("source"),
    data: text("data").notNull(), // JSON
    created_at: integer("created_at").notNull(),
    updated_at: integer("updated_at").notNull(),
    deleted_at: integer("deleted_at"),
  },
  (table) => ({
    collectionIdx: index("idx_items_collection").on(table.collection_id),
    deletedIdx: index("idx_items_deleted").on(table.deleted_at),
  }),
)

// ── Relations ─────────────────────────────────────────────────────────────────

export const relations = sqliteTable(
  "relations",
  {
    id: text("id").primaryKey(),
    source_item_id: text("source_item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    source_field_id: text("source_field_id")
      .notNull()
      .references(() => fields.id, { onDelete: "cascade" }),
    target_item_id: text("target_item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    target_collection_id: text("target_collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    sort_order: integer("sort_order").default(0),
    created_at: integer("created_at").notNull(),
  },
  (table) => ({
    sourceIdx: index("idx_relations_source").on(table.source_item_id, table.source_field_id),
    targetIdx: index("idx_relations_target").on(table.target_item_id),
  }),
)

// ── Item Versions ─────────────────────────────────────────────────────────────

export const itemVersions = sqliteTable(
  "item_versions",
  {
    id: text("id").primaryKey(),
    item_id: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    data: text("data").notNull(), // JSON
    source: text("source"),
    created_at: integer("created_at").notNull(),
  },
  (table) => ({
    itemIdx: index("idx_item_versions_item").on(table.item_id),
  }),
)

// ── Item Locks ────────────────────────────────────────────────────────────────

export const itemLocks = sqliteTable("item_locks", {
  id: text("id").primaryKey(),
  item_id: text("item_id")
    .notNull()
    .unique()
    .references(() => items.id, { onDelete: "cascade" }),
  locked_by: text("locked_by").notNull(),
  reason: text("reason"),
  expires_at: integer("expires_at").notNull(),
  created_at: integer("created_at").notNull(),
})

// ── Files ─────────────────────────────────────────────────────────────────────

export const files = sqliteTable("files", {
  hash: text("hash").primaryKey(),
  original_name: text("original_name").notNull(),
  mime_type: text("mime_type").notNull(),
  size: integer("size").notNull(),
  storage_path: text("storage_path").notNull(),
  ref_count: integer("ref_count").default(1),
  width: integer("width"),
  height: integer("height"),
  duration: real("duration"),
  frame_rate: real("frame_rate"),
  video_codec: text("video_codec"),
  audio_codec: text("audio_codec"),
  bitrate: integer("bitrate"),
  sample_rate: integer("sample_rate"),
  channels: integer("channels"),
  orientation: integer("orientation"),
  color_space: text("color_space"),
  metadata: text("metadata"), // JSON
  created_at: integer("created_at").notNull(),
})

// ── Item Files ────────────────────────────────────────────────────────────────

export const itemFiles = sqliteTable(
  "item_files",
  {
    id: text("id").primaryKey(),
    item_id: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    field_id: text("field_id"),
    file_hash: text("file_hash")
      .notNull()
      .references(() => files.hash, { onDelete: "cascade" }),
    sort_order: integer("sort_order").default(0),
    metadata: text("metadata"), // JSON
    created_at: integer("created_at").notNull(),
  },
  (table) => ({
    itemIdx: index("idx_item_files_item").on(table.item_id),
  }),
)

// ── File Thumbnails ───────────────────────────────────────────────────────────

export const fileThumbnails = sqliteTable(
  "file_thumbnails",
  {
    id: text("id").primaryKey(),
    file_hash: text("file_hash")
      .notNull()
      .references(() => files.hash, { onDelete: "cascade" }),
    size_name: text("size_name", { enum: ["small", "medium", "large"] }).notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    format: text("format").default("webp"),
    storage_path: text("storage_path").notNull(),
    created_at: integer("created_at").notNull(),
  },
  (table) => ({
    hashIdx: index("idx_file_thumbnails_hash").on(table.file_hash),
  }),
)

// ── Field Migrations ──────────────────────────────────────────────────────────

export const fieldMigrations = sqliteTable(
  "field_migrations",
  {
    id: text("id").primaryKey(),
    collection_id: text("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    schema_version: integer("schema_version").notNull(),
    operation: text("operation", { enum: ["add", "delete", "rename", "change_type"] }).notNull(),
    field_name: text("field_name").notNull(),
    old_field_name: text("old_field_name"),
    old_field_type: text("old_field_type"),
    new_field_type: text("new_field_type"),
    default_value: text("default_value"),
    created_at: integer("created_at").notNull(),
  },
  (table) => ({
    collectionIdx: index("idx_field_migrations_collection").on(table.collection_id),
  }),
)

// ── Templates ─────────────────────────────────────────────────────────────────

export const templates = sqliteTable("templates", {
  id: text("id").primaryKey(),
  type: text("type", { enum: ["project", "collection"] }).notNull(),
  source: text("source", { enum: ["builtin", "user", "community"] }).notNull(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon"),
  color: text("color"),
  preview: text("preview"),
  version: integer("version").default(1),
  author: text("author"),
  config: text("config").notNull(), // JSON
  created_at: integer("created_at").notNull(),
})

export const templateTags = sqliteTable(
  "template_tags",
  {
    id: text("id").primaryKey(),
    template_type: text("template_type").notNull(),
    template_id: text("template_id")
      .notNull()
      .references(() => templates.id, { onDelete: "cascade" }),
    tag: text("tag").notNull(),
  },
  (table) => ({
    tagIdx: index("idx_template_tags_tag").on(table.tag),
  }),
)
