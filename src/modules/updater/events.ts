import { z } from "zod"
import type { EventoRegistry } from "@/lib/evento/types"

export const updaterRegistry: EventoRegistry = {
  "app:checkUpdate": {
    schema: z.object({}).optional(),
    description: "events.updater.checkUpdate",
  },
  "app:updateStatus": {
    schema: z.object({
      status: z.enum(["checking", "available", "latest", "error", "downloading", "applying"]),
      currentVersion: z.string().optional(),
      latestVersion: z.string().optional(),
      error: z.string().optional(),
    }),
    description: "events.updater.updateStatus",
  },
  "app:startUpdate": {
    schema: z.object({}).optional(),
    description: "events.updater.startUpdate",
  },
}

export type UpdaterEventMap = {
  "app:checkUpdate": void
  "app:updateStatus": {
    status: "checking" | "available" | "latest" | "error" | "downloading" | "applying"
    currentVersion?: string
    latestVersion?: string
    error?: string
  }
  "app:startUpdate": void
}
