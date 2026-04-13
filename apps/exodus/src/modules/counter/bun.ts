import type { EventoBun } from "@/bun/evento"

export function initCounter(evento: EventoBun) {
  let count = 0
  let autoIncrement = false

  evento.on("counter:increment", (ctx) => {
    count++
    evento.forward("counter:updated", { count, autoIncrement }, ctx)
  })

  evento.on("counter:reset", (ctx) => {
    count = 0
    evento.forward("counter:updated", { count, autoIncrement }, ctx)
  })

  evento.on("timer:tick", (ctx) => {
    if (autoIncrement) {
      count++
      evento.forward("counter:updated", { count, autoIncrement }, ctx)
    }
  })

  evento.on("counter:auto:enable", (ctx) => {
    autoIncrement = true
    evento.forward("counter:updated", { count, autoIncrement }, ctx)
  })

  evento.on("counter:auto:disable", (ctx) => {
    autoIncrement = false
    evento.forward("counter:updated", { count, autoIncrement }, ctx)
  })

  evento.on("counter:query", (ctx) => {
    evento.reply(ctx, { count, autoIncrement })
  })

  evento.emitEvent("counter:updated", { count, autoIncrement }, "counter:init")

  evento.on("counter:updated", ({ payload }) => {
    if (payload.count >= 100) {
      evento.emitEvent("counter:reset", "counter:auto_reset")
    }
  })
}
