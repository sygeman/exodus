import { z } from "zod"

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
