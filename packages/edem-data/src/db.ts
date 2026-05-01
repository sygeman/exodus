import { join } from "path"
import { Database } from "bun:sqlite"
import { drizzle } from "drizzle-orm/bun-sqlite"
import { migrate } from "drizzle-orm/bun-sqlite/migrator"
import * as schema from "./schema"

export interface DataEngineOptions {
  dbPath: string
}

export function createDataEngine(options: DataEngineOptions) {
  const { dbPath } = options
  const sqlite = new Database(dbPath)

  sqlite.exec("PRAGMA journal_mode = WAL")
  sqlite.exec("PRAGMA foreign_keys = ON")

  const db = drizzle(sqlite, { schema })

  const migrationsFolder = join(import.meta.dir, "../drizzle")
  migrate(db, { migrationsFolder })

  return { db, sqlite }
}

export type DataEngine = ReturnType<typeof createDataEngine>
