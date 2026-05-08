import type { dataModule } from "@exodus/edem-data"
import type { InferModuleAPI } from "@exodus/edem-core"
import type { LogLevel } from "@/modules/logger/types"
import { createDedup } from "@/modules/logger/dedup"

type EdemData = InferModuleAPI<typeof dataModule>

let edemData: EdemData | null = null

const { add } = createDedup((entry) => {
  if (!edemData) return
  edemData.createItem({ collection_id: "logs", data: { ...entry, source: "bun" } }).catch(() => {})
})

class BunLogger {
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
