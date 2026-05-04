import { z } from "zod"
import { createRegistry } from "@exodus/evento"

export const updaterRegistry = createRegistry("updater", {
  "check-update": {
    schema: z.object({}).optional(),
  },
  "start-update": {
    schema: z.object({}).optional(),
  },
})

export type UpdaterEventMap = {
  "updater:check-update": void
  "updater:start-update": void
}
