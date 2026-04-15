import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"

export const logs = sqliteTable("logs", {
  id: text("id").primaryKey(),
  timestamp: integer("timestamp", { mode: "number" }).notNull(),
  level: text("level").notNull(),
  source: text("source").notNull(),
  message: text("message").notNull(),
  args: text("args").notNull(),
  count: integer("count", { mode: "number" }),
})

export type LogRow = typeof logs.$inferSelect
export type NewLogRow = typeof logs.$inferInsert
