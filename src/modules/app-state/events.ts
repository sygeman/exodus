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
    }),
    description: "Restore saved app state to webview",
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
  }
  "app:dismissUpdate": { version: string }
  "app:clearDismissedUpdate": void
}
