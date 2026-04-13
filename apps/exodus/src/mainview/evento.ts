import { Electroview } from "electrobun/view"
import type { RPCSchema } from "electrobun"
import { Evento, type EventoMetaType } from "../lib/evento/evento"
import type { GlobalEventMap } from "../events"

export function createEventoWebview<EventMap extends Record<string, unknown> = GlobalEventMap>() {
  const evento = new Evento<"webview", ["bun"], EventMap>("webview", "bun")

  type EventoMeta = EventoMetaType<typeof evento>

  const rpc = Electroview.defineRPC<{
    bun: RPCSchema<{ messages: { emit: { name: string; payload: unknown; meta: EventoMeta } } }>
    webview: RPCSchema<{
      messages: { emit: { name: string; payload: unknown; meta: EventoMeta } }
    }>
  }>({
    handlers: {
      messages: {
        emit: ({ name, payload, meta }) => {
          evento.emitLocal(name, payload, meta)
        },
      },
    },
  })

  return { evento, rpc }
}

export const { evento, rpc } = createEventoWebview()
