import { edem } from "@/edem"
import type { LogEntry, LogLevel } from "@/modules/logger/types"

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

  const logs = items.map((item) => ({
    id: item.id,
    timestamp: item.created_at,
    level: item.data.level as LogLevel,
    source: item.data.source as "bun" | "webview",
    message: item.data.message as string,
    args: (item.data.args as unknown[]) ?? [],
    count: item.data.count as number | undefined,
  }))

  return { logs, total }
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
        .queryItems({
          collection_id: "logs",
          filter: { level: { _eq: level } },
          limit: 1,
        })
        .then(({ total }) => total),
    ),
  )
  return { debug, info, warn, error }
}

export async function clearLogs(source: "bun" | "webview" | "all" = "all") {
  const { items } = await edem.data.queryItems({
    collection_id: "logs",
    filter: source !== "all" ? { source: { _eq: source } } : undefined,
  })
  for (const item of items) {
    await edem.data.deleteItem({ item_id: item.id })
  }
}
