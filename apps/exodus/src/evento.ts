import { Electroview } from "electrobun/view"
import type { RPCSchema } from "electrobun"
import { Evento, type EventoMetaType } from "@exodus/evento"
import { createWebviewEdemBridge } from "@exodus/edem-electrobun/webview"
import type { EdemMsg } from "@exodus/edem-electrobun/types"
import { globalRegistry, type GlobalEventMap } from "@/events"

const evento = new Evento<"webview", ["bun"], GlobalEventMap>("webview", "bun")
evento.register(globalRegistry)

const edemBridge = createWebviewEdemBridge()

type EventoMeta = EventoMetaType<typeof evento>

const rpc = Electroview.defineRPC<{
  bun: RPCSchema<{
    messages: { emit: { name: string; payload: unknown; meta: EventoMeta }; edem: EdemMsg }
  }>
  webview: RPCSchema<{
    messages: { emit: { name: string; payload: unknown; meta: EventoMeta }; edem: EdemMsg }
  }>
}>({
  handlers: {
    messages: {
      emit: (msg: { name: string; payload: unknown; meta: EventoMeta }) => {
        evento.emitLocal(msg.name, msg.payload, msg.meta)
      },
      edem: (msg: EdemMsg) => {
        edemBridge.handler(msg)
      },
    },
  },
})

edemBridge.attachBun(rpc.send.edem)

export { evento, rpc, edemBridge }
