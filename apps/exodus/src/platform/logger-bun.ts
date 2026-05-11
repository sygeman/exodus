import type { dataModule } from "@exodus/edem-data"
import type { InferModuleAPI } from "@exodus/edem-core"
import { type LogLevel, createDedup } from "./logger-shared"

export type { LogLevel, LogEntry } from "./logger-shared"

type EdemData = InferModuleAPI<typeof dataModule>

class BunLogger {
  private edemData: EdemData | null = null
  private patched = false

  attach(data: EdemData) {
    this.edemData = data
    this.patchConsole()
  }

  private patchConsole() {
    if (this.patched) return
    this.patched = true

    const original = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
      debug: console.debug,
    }

    const { add } = createDedup((entry) => {
      if (!this.edemData) return
      this.edemData
        .createItem({ collection_id: "logs", data: { ...entry, source: "bun" } })
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
}

export const bunLogger = new BunLogger()
