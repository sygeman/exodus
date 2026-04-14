import { z } from "zod"
import type { EventoRegistry } from "@/lib/evento/types"

export const timerRegistry: EventoRegistry = {
  "timer:tick": {
    schema: z.object({ time: z.number() }),
    description: "Timer tick with current time",
  },
}

export type TimerEventMap = {
  "timer:tick": { time: number }
}

export const timerOutgoingEvents = ["timer:tick"] as const
