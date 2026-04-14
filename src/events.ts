import { z } from "zod"
import { counterRegistry } from "./modules/counter/events"
import { timerRegistry } from "./modules/timer/events"
import { loggerRegistry } from "./modules/logger/events"
import type { EventoRegistry } from "./lib/evento/types"
import type { CounterEventMap } from "./modules/counter/events"
import type { TimerEventMap } from "./modules/timer/events"
import type { LoggerEventMap } from "./modules/logger/events"

export type GlobalEventMap = CounterEventMap & TimerEventMap & LoggerEventMap

export const globalRegistry: EventoRegistry = {
  ...counterRegistry,
  ...timerRegistry,
  ...loggerRegistry,
  "app:checkUpdate": {
    schema: z.object({}).optional(),
    description: "Check for app updates",
  },
  "app:checkUpdate:response": {
    schema: z.object({
      data: z.object({
        updateAvailable: z.boolean(),
        currentVersion: z.string().optional(),
        latestVersion: z.string().optional(),
        error: z.string().optional(),
      }),
      correlation_id: z.string().optional(),
    }),
    description: "App update check response",
  },
  "evento:schema:request": {
    schema: z.object({ name: z.string() }),
    description: "Request event schema",
  },
  "evento:schema:request:response": {
    schema: z.object({ name: z.string(), schema: z.any(), description: z.string().optional() }),
    description: "Event schema response",
  },
}
