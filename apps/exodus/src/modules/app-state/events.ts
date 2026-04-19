import { z } from "zod"
import { createRegistry } from "@/lib/evento/registry"

export const appStateRegistry = createRegistry("app-state", {
  "route-changed": {
    schema: z.object({ hash: z.string() }),
  },
  "request-state": {
    schema: z.void(),
  },
  "restore-state": {
    schema: z.object({
      hash: z.string().nullable(),
      dismissed_update_version: z.string().nullable(),
      locale: z.string().nullable(),
      theme: z.enum(["dark", "light"]).nullable(),
      window_frame: z
        .object({
          x: z.number(),
          y: z.number(),
          width: z.number(),
          height: z.number(),
        })
        .nullable(),
      window_maximized: z.boolean().nullable(),
    }),
  },
  "save-settings": {
    schema: z.object({
      locale: z.string().optional(),
      theme: z.enum(["dark", "light"]).optional(),
    }),
  },
  "dismiss-update": {
    schema: z.object({ version: z.string() }),
  },
  "clear-dismissed-update": {
    schema: z.void(),
  },
})

export type AppStateEventMap = {
  "app-state:route-changed": { hash: string }
  "app-state:request-state": void
  "app-state:restore-state": {
    hash: string | null
    dismissed_update_version: string | null
    locale: string | null
    theme: "dark" | "light" | null
    window_frame: { x: number; y: number; width: number; height: number } | null
    window_maximized: boolean | null
  }
  "app-state:save-settings": { locale?: string; theme?: "dark" | "light" }
  "app-state:dismiss-update": { version: string }
  "app-state:clear-dismissed-update": void
}
