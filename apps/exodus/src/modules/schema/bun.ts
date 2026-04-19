import type { EventoBun } from "@/bun/evento"

export function initSchema(evento: EventoBun) {
  evento.handle("schema:request", (ctx) => {
    const name = ctx.payload.name
    const entry = evento.getSchema(name)
    const serialized = entry ? evento.serializeSchema(name) : null
    return {
      name,
      schema: serialized,
    }
  })
}
