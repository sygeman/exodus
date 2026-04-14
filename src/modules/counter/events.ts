import { z } from "zod"
import type { EventoRegistry } from "@/lib/evento/types"

export const counterRegistry: EventoRegistry = {
  "counter:increment": { schema: z.void(), description: "Increment counter" },
  "counter:reset": { schema: z.void(), description: "Reset counter" },
  "counter:updated": {
    schema: z.object({ count: z.number(), autoIncrement: z.boolean() }),
    description: "Counter value updated",
  },
  "counter:auto:enable": { schema: z.void(), description: "Enable auto increment" },
  "counter:auto:disable": { schema: z.void(), description: "Disable auto increment" },
  "counter:query": {
    schema: z.object({ correlation_id: z.string().optional() }),
    description: "Query counter state",
  },
}

export type CounterEventMap = {
  "counter:increment": void
  "counter:reset": void
  "counter:updated": { count: number; autoIncrement: boolean }
  "counter:auto:enable": void
  "counter:auto:disable": void
  "counter:query": { correlation_id?: string }
}

export const counterOutgoingEvents = ["counter:updated"] as const
