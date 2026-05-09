import type { dataModule } from "@exodus/edem-data"
import type { InferModuleAPI } from "@exodus/edem-core"

type EdemData = InferModuleAPI<typeof dataModule>

let edemData: EdemData | null = null

// Dedup: repeated warn/error within 1000ms get count++
const pending = new Map<
  string,
  {
    level: string
    message: string
    source: string
    args?: unknown
    count: number
    timer: ReturnType<typeof setTimeout>
  }
>()

function flush(entry: { level: string; message: string; source: string; args?: unknown }) {
  if (!edemData) return
  edemData.createItem({ collection_id: "logs", data: { ...entry, source: "bun" } }).catch(() => {})
}

function add(level: string, args: unknown[]) {
  const message = args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ")
  const key = `${level}:${message}`

  const existing = pending.get(key)
  if (existing) {
    existing.count++
    clearTimeout(existing.timer)
    existing.timer = setTimeout(() => {
      pending.delete(key)
      flush({
        level: existing.level,
        message: existing.message,
        source: existing.source,
        args: existing.args,
      })
    }, 1000)
    return
  }

  const timer = setTimeout(() => {
    pending.delete(key)
    flush({ level, message, source: "bun", args: args.length > 1 ? args : undefined })
  }, 1000)

  pending.set(key, {
    level,
    message,
    source: "bun",
    args: args.length > 1 ? args : undefined,
    count: 1,
    timer,
  })
}

class Logger {
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
      (level: "info" | "warn" | "error" | "debug") =>
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
}

export const logger = new Logger()
