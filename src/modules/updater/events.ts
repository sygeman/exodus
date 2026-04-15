import { z } from "zod"
import type { EventoRegistry } from "@/lib/evento/types"

export const updaterRegistry: EventoRegistry = {
  "updater:checkUpdate": {
    schema: z.object({}).optional(),
  },
  "updater:updateStatus": {
    schema: z.object({
      status: z.enum(["checking", "available", "latest", "error", "downloading", "applying"]),
      currentVersion: z.string().optional(),
      latestVersion: z.string().optional(),
      error: z.string().optional(),
    }),
  },
  "updater:startUpdate": {
    schema: z.object({}).optional(),
  },
}

export type UpdaterEventMap = {
  "updater:checkUpdate": void
  "updater:updateStatus": {
    status: "checking" | "available" | "latest" | "error" | "downloading" | "applying"
    currentVersion?: string
    latestVersion?: string
    error?: string
  }
  "updater:startUpdate": void
}
