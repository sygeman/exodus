import { z } from "zod"
import type { EventoRegistry } from "@/lib/evento/types"

export const appStateRegistry: EventoRegistry = {
  "app:routeChanged": {
    schema: z.object({ hash: z.string() }),
  },
  "app:requestState": {
    schema: z.void(),
  },
  "app:restoreState": {
    schema: z.object({
      hash: z.string().nullable(),
      dismissedUpdateVersion: z.string().nullable(),
      locale: z.string().nullable(),
      theme: z.enum(["dark", "light"]).nullable(),
    }),
  },
  "app:saveSettings": {
    schema: z.object({
      locale: z.string().optional(),
      theme: z.enum(["dark", "light"]).optional(),
    }),
  },
  "app:dismissUpdate": {
    schema: z.object({ version: z.string() }),
  },
  "app:clearDismissedUpdate": {
    schema: z.void(),
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
