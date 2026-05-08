import { edem } from "@/edem"
import type { LogLevel } from "@/modules/logger/types"
import { createDedup } from "@/modules/logger/dedup"
import { queryLogs, queryLogStats, clearLogs } from "@/modules/logger/query"

const { add } = createDedup((entry) => {
  edem.data
    .createItem({ collection_id: "logs", data: { ...entry, source: "webview" } })
    .catch(() => {})
})

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
