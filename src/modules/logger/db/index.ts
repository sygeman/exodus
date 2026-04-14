import { drizzle } from "drizzle-orm/bun-sqlite"
import { Database } from "bun:sqlite"
import { join, dirname } from "path"
import { logs } from "./schema"
import { desc, and, eq, gte, lte, like, or, sql } from "drizzle-orm"
import type { LogEntry } from "../events"
import { mkdirSync } from "fs"
import { Utils } from "electrobun/bun"

function getDbPath(): string {
  if (process.env.LOGS_DB_PATH) return process.env.LOGS_DB_PATH

  try {
    return join(Utils.paths.userData, "logs.db")
  } catch {
    // Fallback for dev mode when version.json is unavailable
    return join(Utils.paths.home, ".local", "share", "Exodus", "dev", "logs.db")
  }
}

const DB_PATH = getDbPath()

// Ensure directory exists
const dir = dirname(DB_PATH)
mkdirSync(dir, { recursive: true })

const sqlite = new Database(DB_PATH)
sqlite.exec("PRAGMA journal_mode = WAL;")

export const db = drizzle(sqlite, { schema: { logs } })

export function migrate() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS logs (
      id TEXT PRIMARY KEY,
      timestamp INTEGER NOT NULL,
      level TEXT NOT NULL,
      source TEXT NOT NULL,
      message TEXT NOT NULL,
      args TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);
    CREATE INDEX IF NOT EXISTS idx_logs_source ON logs(source);
  `)
}

export function insertLog(entry: LogEntry) {
  db.insert(logs)
    .values({
      id: entry.id,
      timestamp: entry.timestamp,
      level: entry.level,
      source: entry.source,
      message: entry.message,
      args: JSON.stringify(entry.args),
    })
    .run()
}

export interface LogQuery {
  level?: string
  source?: string
  search?: string
  from?: number
  to?: number
  limit?: number
  offset?: number
}

export function queryLogs(q: LogQuery): LogEntry[] {
  const conditions = []
  if (q.level && q.level !== "all") {
    conditions.push(eq(logs.level, q.level))
  }
  if (q.source && q.source !== "all") {
    conditions.push(eq(logs.source, q.source))
  }
  if (q.from) {
    conditions.push(gte(logs.timestamp, q.from))
  }
  if (q.to) {
    conditions.push(lte(logs.timestamp, q.to))
  }
  if (q.search?.trim()) {
    const s = `%${q.search.trim()}%`
    conditions.push(or(like(logs.message, s), like(logs.args, s))!)
  }

  const rows = db
    .select()
    .from(logs)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(logs.timestamp))
    .limit(q.limit || 500)
    .offset(q.offset || 0)
    .all()

  return rows.map((r) => {
    let parsedArgs: unknown[] = []
    try {
      parsedArgs = JSON.parse(r.args)
      if (!Array.isArray(parsedArgs)) parsedArgs = []
    } catch {
      parsedArgs = []
    }
    return {
      id: r.id,
      timestamp: r.timestamp,
      level: r.level as LogEntry["level"],
      source: r.source as LogEntry["source"],
      message: r.message,
      args: parsedArgs,
    }
  })
}

export function countLogs(q: Omit<LogQuery, "limit" | "offset">): number {
  const conditions = []
  if (q.level && q.level !== "all") {
    conditions.push(eq(logs.level, q.level))
  }
  if (q.source && q.source !== "all") {
    conditions.push(eq(logs.source, q.source))
  }
  if (q.from) {
    conditions.push(gte(logs.timestamp, q.from))
  }
  if (q.to) {
    conditions.push(lte(logs.timestamp, q.to))
  }
  if (q.search?.trim()) {
    const s = `%${q.search.trim()}%`
    conditions.push(or(like(logs.message, s), like(logs.args, s))!)
  }

  const row = db
    .select({ count: sql<number>`COUNT(*)` })
    .from(logs)
    .where(conditions.length ? and(...conditions) : undefined)
    .get()

  return row?.count || 0
}

export function clearLogs(source: "bun" | "webview" | "all") {
  if (source === "all") {
    db.delete(logs).run()
  } else {
    db.delete(logs).where(eq(logs.source, source)).run()
  }
}

export function getStats() {
  const rows = db
    .select({
      level: logs.level,
      count: sql<number>`COUNT(*)`,
    })
    .from(logs)
    .groupBy(logs.level)
    .all()

  const stats = { debug: 0, info: 0, warn: 0, error: 0 }
  for (const r of rows) {
    if (r.level in stats) {
      stats[r.level as keyof typeof stats] = r.count
    }
  }
  return stats
}
