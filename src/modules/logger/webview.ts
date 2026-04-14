import { evento } from "@/mainview/evento"
import { loggerRegistry, type LogEntry, type LogLevel } from "@/modules/logger/events"

class WebviewLogger {
  private patched = false

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
    const res = await evento.request("logger:query", q, { timeout: 5000 })
    return res.data as { logs: LogEntry[]; total: number }
  }

  async stats(): Promise<{ debug: number; info: number; warn: number; error: number }> {
    const res = await evento.request("logger:stats", {}, { timeout: 2000 })
    return res.data as { debug: number; info: number; warn: number; error: number }
  }
}

export const webviewLogger = new WebviewLogger()
