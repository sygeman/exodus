import { z } from "zod"
import { createRegistry } from "@exodus/evento"

export const updaterRegistry = createRegistry("updater", {
  "check-update": {
    schema: z.object({}).optional(),
  },
  "update-status": {
    schema: z.object({
      status: z.enum(["checking", "available", "latest", "error", "downloading", "applying"]),
      current_version: z.string().optional(),
      latest_version: z.string().optional(),
      error: z.string().optional(),
    }),
  },
  "start-update": {
    schema: z.object({}).optional(),
  },
})

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
