import { z } from "zod"
import type { EventoRegistry } from "@/lib/evento/types"

export const appStateRegistry: EventoRegistry = {
  "app-state:route-changed": {
    schema: z.object({ hash: z.string() }),
  },
  "app-state:request-state": {
    schema: z.void(),
  },
  "app-state:restore-state": {
    schema: z.object({
      hash: z.string().nullable(),
      dismissed_update_version: z.string().nullable(),
      locale: z.string().nullable(),
      theme: z.enum(["dark", "light"]).nullable(),
    }),
  },
  "app-state:save-settings": {
    schema: z.object({
      locale: z.string().optional(),
      theme: z.enum(["dark", "light"]).optional(),
    }),
  },
  "app-state:dismiss-update": {
    schema: z.object({ version: z.string() }),
  },
  "app-state:clear-dismissed-update": {
    schema: z.void(),
  },
}

export type AppStateEventMap = {
  "app-state:route-changed": { hash: string }
  "app-state:request-state": void
  "app-state:restore-state": {
    hash: string | null
    dismissed_update_version: string | null
    locale: string | null
    theme: "dark" | "light" | null
  }
  "app-state:save-settings": { locale?: string; theme?: "dark" | "light" }
  "app-state:dismiss-update": { version: string }
  "app-state:clear-dismissed-update": void
}
