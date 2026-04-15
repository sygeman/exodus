import { z } from "zod"
import type { EventoRegistry } from "@/lib/evento/types"

export const updaterRegistry: EventoRegistry = {
  "updater:check-update": {
    schema: z.object({}).optional(),
  },
  "updater:update-status": {
    schema: z.object({
      status: z.enum(["checking", "available", "latest", "error", "downloading", "applying"]),
      current_version: z.string().optional(),
      latest_version: z.string().optional(),
      error: z.string().optional(),
    }),
  },
  "updater:start-update": {
    schema: z.object({}).optional(),
  },
}

export type UpdaterEventMap = {
  "updater:check-update": void
  "updater:update-status": {
    status: "checking" | "available" | "latest" | "error" | "downloading" | "applying"
    current_version?: string
    latest_version?: string
    error?: string
  }
  "updater:start-update": void
}
