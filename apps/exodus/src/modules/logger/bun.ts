import type { dataModule } from "@exodus/edem-data"
import type { InferModuleAPI } from "@exodus/edem-core"
import type { LogLevel } from "@/modules/logger/types"

type EdemData = InferModuleAPI<typeof dataModule>

interface DedupState {
  count: number
  lastArgs: unknown[]
  timeout: ReturnType<typeof setTimeout>
}

let edemData: EdemData | null = null

async function insertLog(data: {
  level: LogLevel
  message: string
  source: "bun"
  args: unknown[]
  count?: number
}) {
  if (!edemData) return
  try {
    await edemData.createItem({ collection_id: "logs", data })
  } catch {
    // ignore storage errors
  }
}

class BunLogger {
  private dedupWindow = 1000
  private recentLogs = new Map<string, number>()
  private pendingDedups = new Map<string, DedupState>()

  attach(data: EdemData) {
    edemData = data
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

    insertLog({
      level,
      message: baseMessage,
      source: "bun",
      args: state.lastArgs.map((a) =>
        typeof a === "object" && a !== null ? JSON.parse(JSON.stringify(a)) : a,
      ),
      count: state.count,
    })

    this.pendingDedups.delete(key)
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

    insertLog({
      level,
      message,
      source: "bun",
      args: args.map((a) =>
        typeof a === "object" && a !== null ? JSON.parse(JSON.stringify(a)) : a,
      ),
    })
  }
}

export const bunLogger = new BunLogger()
