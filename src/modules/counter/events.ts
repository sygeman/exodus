import { z } from "zod"
import type { EventoRegistry } from "@/lib/evento/types"

export const counterRegistry: EventoRegistry = {
  "counter:increment": { schema: z.void(), description: "events.counter.increment" },
  "counter:reset": { schema: z.void(), description: "events.counter.reset" },
  "counter:updated": {
    schema: z.object({ count: z.number(), autoIncrement: z.boolean() }),
    description: "events.counter.updated",
  },
  "counter:auto:enable": { schema: z.void(), description: "events.counter.auto:enable" },
  "counter:auto:disable": { schema: z.void(), description: "events.counter.auto:disable" },
  "counter:query": {
    schema: z.object({ correlation_id: z.string().optional() }),
    description: "events.counter.query",
  },
  "counter:query:response": {
    schema: z.object({
      data: z.object({ count: z.number(), autoIncrement: z.boolean() }),
      correlation_id: z.string().optional(),
    }),
    description: "events.counter.query:response",
  },
}

export type CounterEventMap = {
  "counter:increment": void
  "counter:reset": void
  "counter:updated": { count: number; autoIncrement: boolean }
  "counter:auto:enable": void
  "counter:auto:disable": void
  "counter:query": { correlation_id?: string }
  "counter:query:response": { count: number; autoIncrement: boolean; correlation_id?: string }
}

export const counterOutgoingEvents = ["counter:updated"] as const
