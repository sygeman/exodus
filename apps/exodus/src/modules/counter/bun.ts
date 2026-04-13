import type { EventoBun } from "../../bun/evento"

export function initCounter(evento: EventoBun) {
  let count = 0

  evento.on("counter:increment", (ctx) => {
    count++
    evento.forward("counter:updated", { count }, ctx)
  })

  evento.on("counter:reset", (ctx) => {
    count = 0
    evento.forward("counter:updated", { count }, ctx)
  })

  evento.on("timer:tick", (ctx) => {
    count++
    evento.forward("counter:updated", { count }, ctx)
  })

  evento.emitEvent("counter:updated", { count }, "counter:init")

  evento.on("counter:updated", ({ payload }) => {
    if (payload.count >= 100) {
      evento.emitEvent("counter:reset", "counter:auto_reset")
    }
  })
}
