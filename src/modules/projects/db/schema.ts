import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull(),
  created_at: integer("created_at", { mode: "number" }).notNull(),
})

export type ProjectRow = typeof projects.$inferSelect
export type NewProjectRow = typeof projects.$inferInsert

export const ideas = sqliteTable("ideas", {
  id: text("id").primaryKey(),
  project_id: text("project_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  level: text("level"),
  type: text("type"),
  status: text("status").notNull().default("draft"),
  created_at: integer("created_at", { mode: "number" }).notNull(),
  updated_at: integer("updated_at", { mode: "number" }).notNull(),
})

export type IdeaRow = typeof ideas.$inferSelect
export type NewIdeaRow = typeof ideas.$inferInsert
