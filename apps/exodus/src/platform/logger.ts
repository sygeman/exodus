import { edem } from "@/edem"
import type { LogLevel, LogEntry } from "./logger-bun"
export type { LogLevel, LogEntry }

const DEDUP_WINDOW_MS = 1000
const MAX_RECENT_LOGS = 1000

function formatArgs(args: unknown[]): string {
  return args
    .map((a) =>
      typeof a === "string"
        ? a
        : typeof a === "number" || typeof a === "boolean"
          ? String(a)
          : JSON.stringify(a),
    )
    .join(" ")
}

function cloneArgs(args: unknown[]): unknown[] {
  return args.map((a) => {
    try {
      return typeof a === "object" && a !== null ? JSON.parse(JSON.stringify(a)) : a
    } catch {
      return String(a)
    }
  })
}

function createDedup(
  insertFn: (entry: { level: LogLevel; message: string; args: unknown[]; count?: number }) => void,
) {
  const recentLogs = new Map<string, number>()
  const pendingDedups = new Map<
    string,
    {
      count: number
      lastArgs: unknown[]
      timeout: ReturnType<typeof setTimeout>
    }
  >()

  function shouldDedupe(level: LogLevel, message: string): boolean {
    if (level !== "warn" && level !== "error") return false
    const now = Date.now()
    const key = `${level}:${message}`
    const last = recentLogs.get(key)
    if (last && now - last < DEDUP_WINDOW_MS) {
      return true
    }
    recentLogs.set(key, now)
    if (recentLogs.size > MAX_RECENT_LOGS) {
      const cutoff = now - DEDUP_WINDOW_MS
      for (const [k, v] of recentLogs) {
        if (v < cutoff) recentLogs.delete(k)
      }
    }
    return false
  }

  function flushDedup(key: string, level: LogLevel, baseMessage: string) {
    const state = pendingDedups.get(key)
    if (!state || state.count <= 0) {
      pendingDedups.delete(key)
      return
    }

    insertFn({
      level,
      message: baseMessage,
      args: cloneArgs(state.lastArgs),
      count: state.count,
    })

    pendingDedups.delete(key)
  }

  function add(level: LogLevel, args: unknown[]) {
    const message = formatArgs(args)
    const key = `${level}:${message}`

    if (shouldDedupe(level, message)) {
      const existing = pendingDedups.get(key)
      if (existing) {
        existing.count++
        existing.lastArgs = args
      } else {
        const timeout = setTimeout(() => {
          flushDedup(key, level, message)
        }, DEDUP_WINDOW_MS)
        pendingDedups.set(key, { count: 1, lastArgs: args, timeout })
      }
      return
    }

    insertFn({ level, message, args: cloneArgs(args) })
  }

  return { add }
}

export async function queryLogs(q: {
  level?: string
  source?: string
  search?: string
  limit?: number
  offset?: number
}): Promise<{ logs: LogEntry[]; total: number }> {
  const filter: Record<string, unknown> = {}
  if (q.level && q.level !== "all") filter.level = { _eq: q.level }
  if (q.source && q.source !== "all") filter.source = { _eq: q.source }
  if (q.search?.trim()) filter.message = { _contains: q.search.trim() }

  const { items, total } = await edem.data.queryItems({
    collection_id: "logs",
    filter: Object.keys(filter).length > 0 ? filter : undefined,
    sort: ["-created_at"],
    limit: q.limit ?? 500,
    offset: q.offset ?? 0,
  })

  const logs = items.map((item) => ({
    id: item.id,
    timestamp: item.created_at,
    level: item.data.level as LogLevel,
    source: item.data.source as "bun" | "webview",
    message: item.data.message as string,
    args: (item.data.args as unknown[]) ?? [],
    count: item.data.count as number | undefined,
  }))

  return { logs, total }
}

export async function queryLogStats(): Promise<{
  debug: number
  info: number
  warn: number
  error: number
}> {
  const [debug, info, warn, error] = await Promise.all(
    (["debug", "info", "warn", "error"] as const).map((level) =>
      edem.data
        .queryItems({
          collection_id: "logs",
          filter: { level: { _eq: level } },
          limit: 1,
        })
        .then(({ total }) => total),
    ),
  )
  return { debug, info, warn, error }
}

export async function clearLogs(source: "bun" | "webview" | "all" = "all") {
  const { items } = await edem.data.queryItems({
    collection_id: "logs",
    filter: source !== "all" ? { source: { _eq: source } } : undefined,
  })
  for (const item of items) {
    await edem.data.deleteItem({ item_id: item.id })
  }
}

class WebviewLogger {
  private patched = false

  init() {
    if (this.patched) return
    this.patched = true
    this.patchConsole()
  }

  private patchConsole() {
    const original = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
      debug: console.debug,
    }

    const { add } = createDedup((entry) => {
      edem.data
        .createItem({ collection_id: "logs", data: { ...entry, source: "webview" } })
        .catch(() => {})
    })

    const createHandler =
      (level: LogLevel) =>
      (...args: unknown[]) => {
        original[level].apply(console, args)
        add(level, args)
      }

    console.log = createHandler("info")
    console.info = createHandler("info")
    console.warn = createHandler("warn")
    console.error = createHandler("error")
    console.debug = createHandler("debug")
  }

  clear = clearLogs
  query = queryLogs
  stats = queryLogStats
}

export const webviewLogger = new WebviewLogger()
