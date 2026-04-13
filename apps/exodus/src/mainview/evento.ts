import { Electroview } from "electrobun/view"
import type { RPCSchema } from "electrobun"
import { Evento, type EventoMetaType } from "@/lib/evento/evento"
import type { GlobalEventMap } from "@/events"
import { globalRegistry } from "@/events"

export function createEventoWebview<EventMap extends Record<string, unknown> = GlobalEventMap>() {
  const evento = new Evento<"webview", ["bun"], EventMap>("webview", "bun")
  evento.register(globalRegistry)

  type EventoMeta = EventoMetaType<typeof evento>

  const rpc = Electroview.defineRPC<{
    bun: RPCSchema<{ messages: { emit: { name: string; payload: unknown; meta: EventoMeta } } }>
    webview: RPCSchema<{ messages: { emit: { name: string; payload: unknown; meta: EventoMeta } } }>
  }>({
    handlers: {
      messages: {
        emit: (msg: { name: string; payload: unknown; meta: EventoMeta }) => {
          evento.emitLocal(msg.name, msg.payload, msg.meta)
        },
      },
    },
  })

  return { evento, rpc }
}

export const { evento, rpc } = createEventoWebview()