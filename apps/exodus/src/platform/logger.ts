import { edem } from "@/edem"
import { type LogLevel, type LogEntry, parseLogItem, patchConsole } from "./logger-shared"

export type { LogLevel, LogEntry }

export async function queryLogs(q: {
  level?: string
  source?: string
  search?: string
  limit?: number
  offset?: number
}): Promise<{ logs: LogEntry[]; total: number }> {
  const filter: Record<string, unknown> = {}
  if (q.level && q.level !== "all") filter.level = { _eq: q.level }
  if (q.source && q.source !== "all") filter.source = { _eq: q.source }
  if (q.search?.trim()) filter.message = { _contains: q.search.trim() }

  const { items, total } = await edem.data.queryItems({
    collection_id: "logs",
    filter: Object.keys(filter).length > 0 ? filter : undefined,
    sort: ["-created_at"],
    limit: q.limit ?? 500,
    offset: q.offset ?? 0,
  })

  return { logs: items.map(parseLogItem), total }
}

export async function queryLogStats(): Promise<{
  debug: number
  info: number
  warn: number
  error: number
}> {
  const [debug, info, warn, error] = await Promise.all(
    (["debug", "info", "warn", "error"] as const).map((level) =>
      edem.data
        .countItems({
          collection_id: "logs",
          filter: { level: { _eq: level } },
        })
        .then(({ count }) => count),
    ),
  )
  return { debug, info, warn, error }
}

export async function clearLogs(source: "bun" | "webview" | "all" = "all") {
  const filter = source !== "all" ? { source: { _eq: source } } : undefined
  if (filter) {
    await edem.data.deleteItemsByFilter({ collection_id: "logs", filter })
  } else {
    await edem.data.deleteItemsByFilter({
      collection_id: "logs",
      filter: {},
    })
  }
}

class WebviewLogger {
  private patched = false

  init() {
    if (this.patched) return
    this.patched = true
    patchConsole((entry) => {
      edem.data.createItem({ collection_id: "logs", data: entry }).catch(() => {})
    })
  }

  clear = clearLogs
  query = queryLogs
  stats = queryLogStats
}

export const webviewLogger = new WebviewLogger()
