import type { EventoBun } from "@/bun/evento"
import {
  loggerRegistry,
  LogEntrySchema,
  type LogEntry,
  type LogLevel,
} from "@/modules/logger/events"
import {
  insertLog,
  queryLogs,
  countLogs,
  clearLogs,
  getStats,
  migrate,
} from "@/modules/logger/db/index"

interface DedupState {
  count: number
  lastArgs: unknown[]
  timeout: ReturnType<typeof setTimeout>
}

class BunLogger {
  private evento?: EventoBun
  private dedupWindow = 1000
  private recentLogs = new Map<string, number>()
  private pendingDedups = new Map<string, DedupState>()

  attach(evento: EventoBun) {
    migrate()
    this.evento = evento
    evento.register(loggerRegistry)

    evento.on("logger:entry", (ctx) => {
      const parsed = LogEntrySchema.safeParse(ctx.payload)
      if (!parsed.success) {
        console.warn("[bunLogger] Invalid logger:entry payload:", parsed.error)
        return
      }
      const entry = parsed.data
      if (ctx.meta.source === "bun:logger") return
      insertLog(entry)
      // broadcast to webview so UI can show live updates
      this.evento?.emitEvent("logger:entry", entry, "bun:logger")
    })

    evento.on("logger:clear", (ctx) => {
      const source = (ctx.payload as { source: "bun" | "webview" | "all" }).source
      clearLogs(source)
    })

    evento.on("logger:query", (ctx) => {
      const q = ctx.payload as Parameters<typeof queryLogs>[0]
      const rows = queryLogs(q)
      const total = countLogs(q)
      evento.reply(ctx, { data: { logs: rows, total } })
    })

    evento.on("logger:stats", (ctx) => {
      const stats = getStats()
      evento.reply(ctx, { data: stats })
    })

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

    const createHandler =
      (level: LogLevel) =>
      (...args: unknown[]) => {
        original[level].apply(console, args)
        this.add(level, args)
      }

    console.log = createHandler("info")
    console.info = createHandler("info")
    console.warn = createHandler("warn")
    console.error = createHandler("error")
    console.debug = createHandler("debug")
  }

  private shouldDedupe(level: LogLevel, message: string): boolean {
    if (level !== "warn" && level !== "error") return false
    const now = Date.now()
    const key = `${level}:${message}`
    const last = this.recentLogs.get(key)
    if (last && now - last < this.dedupWindow) {
      return true
    }
    this.recentLogs.set(key, now)
    // Cleanup old entries periodically
    if (this.recentLogs.size > 1000) {
      const cutoff = now - this.dedupWindow
      for (const [k, v] of this.recentLogs) {
        if (v < cutoff) this.recentLogs.delete(k)
      }
    }
    return false
  }

  private flushDedup(key: string, level: LogLevel, baseMessage: string) {
    const state = this.pendingDedups.get(key)
    if (!state || state.count <= 0) {
      this.pendingDedups.delete(key)
      return
    }

    const entry: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      level,
      source: "bun",
      message: baseMessage,
      args: state.lastArgs.map((a) =>
        typeof a === "object" && a !== null ? JSON.parse(JSON.stringify(a)) : a,
      ),
      count: state.count,
    }

    this.pendingDedups.delete(key)
    insertLog(entry)
    this.evento?.emitEvent("logger:entry", entry, "bun:logger")
  }

  private add(level: LogLevel, args: unknown[]) {
    const message = args
      .map((a) =>
        typeof a === "string"
          ? a
          : typeof a === "number" || typeof a === "boolean"
            ? String(a)
            : JSON.stringify(a),
      )
      .join(" ")

    const key = `${level}:${message}`

    if (this.shouldDedupe(level, message)) {
      const existing = this.pendingDedups.get(key)
      if (existing) {
        existing.count++
        existing.lastArgs = args
      } else {
        const timeout = setTimeout(() => {
          this.flushDedup(key, level, message)
        }, this.dedupWindow)
        this.pendingDedups.set(key, { count: 1, lastArgs: args, timeout })
      }
      return
    }

    const entry: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      level,
      source: "bun",
      message,
      args: args.map((a) =>
        typeof a === "object" && a !== null ? JSON.parse(JSON.stringify(a)) : a,
      ),
    }

    insertLog(entry)
    this.evento?.emitEvent("logger:entry", entry, "bun:logger")
  }
}

export const bunLogger = new BunLogger()
