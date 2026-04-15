import { z } from "zod"
import { createRegistry } from "@/lib/evento/registry"

export const counterRegistry = createRegistry("counter", {
  increment: { schema: z.void() },
  reset: { schema: z.void() },
  updated: {
    schema: z.object({ count: z.number(), auto_increment: z.boolean() }),
  },
  "auto-enable": { schema: z.void() },
  "auto-disable": { schema: z.void() },
  query: {
    schema: z.void(),
    response: z.object({ count: z.number(), auto_increment: z.boolean() }),
  },
})

export type CounterEventMap = {
  "counter:increment": void
  "counter:reset": void
  "counter:updated": { count: number; auto_increment: boolean }
  "counter:auto-enable": void
  "counter:auto-disable": void
  "counter:query": void
  "counter:query:response": { count: number; auto_increment: boolean }
}

export const counterOutgoingEvents = ["counter:updated"] as const
