import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"

export const collections = sqliteTable("collections", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  meta: text("meta"), // JSON
})

export const fields = sqliteTable("fields", {
  id: text("id").primaryKey(),
  collection_id: text("collection_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  options: text("options"), // JSON
  required: integer("required").default(0),
  default_value: text("default_value"),
  meta: text("meta"), // JSON
})

export const items = sqliteTable("items", {
  id: text("id").primaryKey(),
  collection_id: text("collection_id").notNull(),
  data: text("data").notNull(), // JSON
  created_at: integer("created_at").notNull(),
  updated_at: integer("updated_at").notNull(),
})
