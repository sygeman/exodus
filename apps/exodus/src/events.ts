import { z } from "zod"
import { counterRegistry } from "./modules/counter/events"
import { timerRegistry } from "./modules/timer/events"
import type { EventoRegistry } from "./lib/evento/types"
import type { CounterEventMap } from "./modules/counter/events"
import type { TimerEventMap } from "./modules/timer/events"

export type GlobalEventMap = CounterEventMap & TimerEventMap

export const globalRegistry: EventoRegistry = {
  ...counterRegistry,
  ...timerRegistry,
  "evento:schema:request": { schema: z.object({ name: z.string() }), description: "Request event schema" },
  "evento:schema:request:response": { schema: z.object({ name: z.string(), schema: z.any(), description: z.string().optional() }), description: "Event schema response" },
}
