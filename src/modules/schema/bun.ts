import type { EventoBun } from "@/bun/evento"

export function initSchema(evento: EventoBun) {
  evento.on("schema:request", (ctx) => {
    const name = ctx.payload.name
    const entry = evento.getSchema(name)
    const serialized = entry ? evento.serializeSchema(name) : null
    evento.reply(ctx, {
      name,
      schema: serialized,
    })
  })
}
