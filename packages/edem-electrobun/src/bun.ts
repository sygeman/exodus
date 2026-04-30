import { BrowserView } from "electrobun/bun"
import type { RPCSchema } from "electrobun"
import { createPlatform } from "@exodus/edem-platform"

type EventHandler = (payload: unknown) => void

function createEventBus() {
  const handlers = new Map<string, Set<EventHandler>>()

  return {
    on(name: string, handler: EventHandler) {
      if (!handlers.has(name)) handlers.set(name, new Set())
      handlers.get(name)!.add(handler)
    },
    emit(name: string, payload: unknown) {
      for (const h of handlers.get(name) ?? []) h(payload)
    },
  }
}

export async function createEdemElectrobun() {
  const edem = createPlatform()
  const bus = createEventBus()

  const rpc = BrowserView.defineRPC<{
    bun: RPCSchema<{ messages: { emit: { name: string; payload: unknown } } }>
    webview: RPCSchema<{
      messages: { emit: { name: string; payload: unknown } }
    }>
  }>({
    handlers: {
      messages: {
        emit: (msg: { name: string; payload: unknown }) => {
          bus.emit(msg.name, msg.payload)
        },
      },
    },
  })

  return { edem, rpc, bus }
}
