import { Electroview } from "electrobun/view"
import type { RPCSchema } from "electrobun"

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

export function createEdemWebview() {
  const bus = createEventBus()

  const rpc = Electroview.defineRPC<{
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

  return { rpc, bus }
}
