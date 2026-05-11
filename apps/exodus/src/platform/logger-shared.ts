export type LogLevel = "debug" | "info" | "warn" | "error"

export interface LogEntry {
  id: string
  timestamp: number
  level: LogLevel
  source: "bun" | "webview"
  message: string
  args: unknown[]
  count?: number
}

const DEDUP_WINDOW_MS = 1000
const MAX_RECENT_LOGS = 1000

export function formatArgs(args: unknown[]): string {
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

export function cloneArgs(args: unknown[]): unknown[] {
  return args.map((a) => {
    try {
      return typeof a === "object" && a !== null ? JSON.parse(JSON.stringify(a)) : a
    } catch {
      return String(a)
    }
  })
}

export function parseLogItem(item: {
  id: string
  created_at: number
  data: Record<string, unknown>
}): LogEntry {
  return {
    id: item.id,
    timestamp: item.created_at,
    level: item.data.level as LogLevel,
    source: item.data.source as "bun" | "webview",
    message: item.data.message as string,
    args: (item.data.args as unknown[]) ?? [],
    count: item.data.count as number | undefined,
  }
}

export function createDedup(
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

export function patchConsole(
  insertFn: (entry: { level: LogLevel; message: string; source: string; args: unknown[] }) => void,
) {
  const original = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
  }

  const { add } = createDedup((entry) => {
    insertFn({ ...entry, source: "webview" })
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
