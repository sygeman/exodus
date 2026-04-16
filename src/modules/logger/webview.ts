import { evento } from "@/evento"
import { loggerRegistry, type LogEntry, type LogLevel } from "@/modules/logger/events"

interface DedupState {
  count: number
  lastArgs: unknown[]
  timeout: ReturnType<typeof setTimeout>
}

class WebviewLogger {
  private patched = false
  private dedupWindow = 1000
  private recentLogs = new Map<string, number>()
  private pendingDedups = new Map<string, DedupState>()

  init() {
    if (this.patched) return
    this.patched = true
    evento.register(loggerRegistry)
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
      source: "webview",
      message: baseMessage,
      args: state.lastArgs.map((a) => {
        try {
          return typeof a === "object" && a !== null ? JSON.parse(JSON.stringify(a)) : a
        } catch {
          return String(a)
        }
      }),
      count: state.count,
    }

    this.pendingDedups.delete(key)
    evento.emitEvent("logger:entry", entry, "webview:logger")
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
      source: "webview",
      message,
      args: args.map((a) => {
        try {
          return typeof a === "object" && a !== null ? JSON.parse(JSON.stringify(a)) : a
        } catch {
          return String(a)
        }
      }),
    }

    evento.emitEvent("logger:entry", entry, "webview:logger")
  }

  clear(source: "bun" | "webview" | "all" = "all") {
    evento.emitEvent("logger:clear", { source }, "user:ui")
  }

  async query(q: {
    level?: string
    source?: string
    search?: string
    from?: number
    to?: number
    limit?: number
    offset?: number
  }): Promise<{ logs: LogEntry[]; total: number }> {
    return evento.request("logger:query", q, { timeout: 5000 })
  }

  async stats(): Promise<{ debug: number; info: number; warn: number; error: number }> {
    return evento.request("logger:stats", undefined, { timeout: 2000 })
  }
}

export const webviewLogger = new WebviewLogger()
