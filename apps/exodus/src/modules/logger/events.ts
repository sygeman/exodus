import { z } from "zod"
import { createRegistry } from "@/lib/evento/registry"

export const LogLevelSchema = z.enum(["debug", "info", "warn", "error"])
export type LogLevel = z.infer<typeof LogLevelSchema>

export interface LogEntry {
  id: string
  timestamp: number
  level: LogLevel
  source: "bun" | "webview"
  message: string
  args: unknown[]
  count?: number
}

export const LogEntrySchema = z.object({
  id: z.string(),
  timestamp: z.number(),
  level: LogLevelSchema,
  source: z.enum(["bun", "webview"]),
  message: z.string(),
  args: z.array(z.unknown()),
  count: z.number().optional(),
})

export const loggerRegistry = createRegistry("logger", {
  entry: {
    schema: LogEntrySchema,
  },
  clear: {
    schema: z.object({ source: z.enum(["bun", "webview", "all"]) }),
  },
  query: {
    schema: z.object({
      level: z.string().optional(),
      source: z.string().optional(),
      search: z.string().optional(),
      from: z.number().optional(),
      to: z.number().optional(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    }),
    response: z.object({ logs: z.array(z.unknown()), total: z.number() }),
  },
  stats: {
    schema: z.void(),
    response: z.object({
      debug: z.number(),
      info: z.number(),
      warn: z.number(),
      error: z.number(),
    }),
  },
})

export type LoggerEventMap = {
  "logger:entry": LogEntry
  "logger:clear": { source: "bun" | "webview" | "all" }
  "logger:query": {
    level?: string
    source?: string
    search?: string
    from?: number
    to?: number
    limit?: number
    offset?: number
  }
  "logger:query:response": { logs: LogEntry[]; total: number }
  "logger:stats": void
  "logger:stats:response": { debug: number; info: number; warn: number; error: number }
}
