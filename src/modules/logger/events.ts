import { z } from "zod"
import type { EventoRegistry } from "@/lib/evento/types"

export const LogLevelSchema = z.enum(["debug", "info", "warn", "error"])
export type LogLevel = z.infer<typeof LogLevelSchema>

export interface LogEntry {
  id: string
  timestamp: number
  level: LogLevel
  source: "bun" | "webview"
  message: string
  args: unknown[]
}

export const LogEntrySchema = z.object({
  id: z.string(),
  timestamp: z.number(),
  level: LogLevelSchema,
  source: z.enum(["bun", "webview"]),
  message: z.string(),
  args: z.array(z.unknown()),
})

export const loggerRegistry: EventoRegistry = {
  "logger:entry": {
    schema: LogEntrySchema,
    description: "Log entry from any process",
  },
  "logger:clear": {
    schema: z.object({ source: z.enum(["bun", "webview", "all"]) }),
    description: "Clear logs",
  },
  "logger:query": {
    schema: z.object({
      level: z.string().optional(),
      source: z.string().optional(),
      search: z.string().optional(),
      from: z.number().optional(),
      to: z.number().optional(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    }),
    description: "Query logs from DB",
  },
  "logger:query:response": {
    schema: z.object({
      data: z.object({ logs: z.array(z.unknown()), total: z.number() }),
      correlation_id: z.string().optional(),
    }),
    description: "Query logs response",
  },
  "logger:stats": {
    schema: z.object({
      correlation_id: z.string().optional(),
    }),
    description: "Get log stats",
  },
  "logger:stats:response": {
    schema: z.object({
      data: z.object({ debug: z.number(), info: z.number(), warn: z.number(), error: z.number() }),
      correlation_id: z.string().optional(),
    }),
    description: "Log stats response",
  },
}

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
  "logger:stats": Record<string, never>
  "logger:stats:response": { debug: number; info: number; warn: number; error: number }
}
