import { z } from "zod"
import type { EventoRegistry } from "@/lib/evento/types"

export const appStateRegistry: EventoRegistry = {
  "app:routeChanged": {
    schema: z.object({ hash: z.string() }),
    description: "Webview route changed",
  },
  "app:requestState": {
    schema: z.void(),
    description: "Request saved app state from bun",
  },
  "app:restoreState": {
    schema: z.object({
      hash: z.string().nullable(),
      dismissedUpdateVersion: z.string().nullable(),
      locale: z.string().nullable(),
      theme: z.enum(["dark", "light"]).nullable(),
    }),
    description: "Restore saved app state to webview",
  },
  "app:saveSettings": {
    schema: z.object({
      locale: z.string().optional(),
      theme: z.enum(["dark", "light"]).optional(),
    }),
    description: "Save user settings",
  },
  "app:dismissUpdate": {
    schema: z.object({ version: z.string() }),
    description: "Dismiss update for a specific version",
  },
  "app:clearDismissedUpdate": {
    schema: z.void(),
    description: "Clear dismissed update version",
  },
}

export type AppStateEventMap = {
  "app:routeChanged": { hash: string }
  "app:requestState": void
  "app:restoreState": {
    hash: string | null
    dismissedUpdateVersion: string | null
    locale: string | null
    theme: "dark" | "light" | null
  }
  "app:saveSettings": { locale?: string; theme?: "dark" | "light" }
  "app:dismissUpdate": { version: string }
  "app:clearDismissedUpdate": void
}
