import { z } from "zod"
import { createRegistry } from "@/lib/evento/registry"

export const timerRegistry = createRegistry("timer", {
  tick: {
    schema: z.object({ time: z.number() }),
  },
})

export type TimerEventMap = {
  "timer:tick": { time: number }
}

export const timerOutgoingEvents = ["timer:tick"] as const
