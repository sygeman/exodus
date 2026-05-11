import { type LogLevel, type LogEntry, patchConsole } from "./logger-shared"

export type { LogLevel, LogEntry } from "./logger-shared"

let patched = false

export function initLogs(writeFn: (entry: LogEntry) => void) {
  if (patched) return
  patched = true

  patchConsole("webview", (entry) => {
    writeFn({
      timestamp: Date.now(),
      level: entry.level as LogLevel,
      source: "webview",
      message: entry.message,
      args: entry.args,
      count: entry.count,
    })
  })
}
