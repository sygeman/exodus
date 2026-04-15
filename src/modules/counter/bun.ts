import type { EventoBun } from "@/bun/evento"

export function initCounter(evento: EventoBun) {
  let count = 0
  let autoIncrement = false

  evento.on("counter:increment", (ctx) => {
    count++
    evento.forward("counter:updated", { count, auto_increment: autoIncrement }, ctx)
  })

  evento.on("counter:reset", (ctx) => {
    count = 0
    evento.forward("counter:updated", { count, auto_increment: autoIncrement }, ctx)
  })

  evento.on("timer:tick", (ctx) => {
    if (autoIncrement) {
      count++
      evento.forward("counter:updated", { count, auto_increment: autoIncrement }, ctx)
    }
  })

  evento.on("counter:auto:enable", (ctx) => {
    autoIncrement = true
    evento.forward("counter:updated", { count, auto_increment: autoIncrement }, ctx)
  })

  evento.on("counter:auto:disable", (ctx) => {
    autoIncrement = false
    evento.forward("counter:updated", { count, auto_increment: autoIncrement }, ctx)
  })

  evento.on("counter:query", (ctx) => {
    evento.reply(ctx, { data: { count, auto_increment: autoIncrement } })
  })

  evento.emitEvent("counter:updated", { count, auto_increment: autoIncrement }, "counter:init")

  evento.on("counter:updated", ({ payload }) => {
    if (payload.count >= 100) {
      evento.emitEvent("counter:reset", "counter:auto_reset")
    }
  })
}
