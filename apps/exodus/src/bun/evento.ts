import { BrowserView } from "electrobun/bun"
import type { RPCSchema } from "electrobun"
import { Evento, type EventoMetaType } from "@/lib/evento/evento"
import type { GlobalEventMap } from "@/events"

export type EventoBun = Evento<"bun", ["webview"], GlobalEventMap>

export function createEventoBun<EventMap extends Record<string, unknown> = GlobalEventMap>() {
  const evento = new Evento<"bun", ["webview"], EventMap>("bun", "webview")

  type EventoMeta = EventoMetaType<typeof evento>

  const rpc = BrowserView.defineRPC<{
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
