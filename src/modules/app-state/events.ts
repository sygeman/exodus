import { z } from "zod"
import type { EventoRegistry } from "@/lib/evento/types"

export const appStateRegistry: EventoRegistry = {
  "app:routeChanged": {
    schema: z.object({ hash: z.string() }),
    description: "Webview route changed",
  },
  "app:restoreRoute": {
    schema: z.object({ hash: z.string().nullable() }),
    description: "Restore saved route to webview",
  },
}

export type AppStateEventMap = {
  "app:routeChanged": { hash: string }
  "app:restoreRoute": { hash: string | null }
}
