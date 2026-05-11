import { type LogLevel, type LogEntry, patchConsole } from "./logger-shared"

export type { LogLevel, LogEntry } from "./logger-shared"

class BunLogger {
  private patched = false

  attach(writeFn: (entry: LogEntry) => void) {
    this.patchConsole(writeFn)
  }

  private patchConsole(writeFn: (entry: LogEntry) => void) {
    if (this.patched) return
    this.patched = true

    patchConsole("bun", (entry) => {
      writeFn({
        timestamp: Date.now(),
        level: entry.level as LogLevel,
        source: "bun",
        message: entry.message,
        args: entry.args,
        count: entry.count,
      })
    })
  }
}

export const bunLogger = new BunLogger()
