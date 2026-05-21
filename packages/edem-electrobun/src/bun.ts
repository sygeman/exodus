import { getModuleSubscriptions } from "@exodus/edem-core"
import type { EdemMsg } from "./types"

interface EdemModule {
  _name: string
  _procs: Record<string, { kind: string }>
}

export function subscribeBunModuleEvents(
  edem: Record<string, Record<string, unknown>>,
  modules: EdemModule[],
  handler: (event: { module: string; name: string; event: unknown }) => void,
): () => void {
  const unsubs: Array<() => void> = []

  for (const mod of modules) {
    const moduleProxy = edem[mod._name] as Record<string, (arg: unknown) => unknown> | undefined
    if (!moduleProxy) {
      continue
    }

    for (const subscriptionName of getModuleSubscriptions(
      mod as Parameters<typeof getModuleSubscriptions>[0],
    )) {
      const subscribe = moduleProxy[subscriptionName] as
        | ((handler: (args: { event: unknown }) => void) => (() => void) | void)
        | undefined

      if (!subscribe) {
        continue
      }

      const unsub = subscribe(({ event }) => {
        handler({ module: mod._name, name: subscriptionName, event })
      })

      if (typeof unsub === "function") {
        unsubs.push(unsub)
      }
    }
  }

  return () => {
    for (const unsub of unsubs) {
      unsub()
    }
  }
}

// ── Bun bridge ───────────────────────────────────────────────────────────────

export function createBunEdemBridge(
  edem: Record<string, Record<string, unknown>>,
  modules: EdemModule[],
) {
  const sendToWebview: ((msg: EdemMsg) => void)[] = []
  const onWebviewEventHandlers: ((name: string, payload: Record<string, unknown>) => void)[] = []

  subscribeBunModuleEvents(edem, modules, ({ module, name, event }) => {
    for (const send of sendToWebview) {
      send({ type: "event", module, name, payload: event })
    }
  })

  return {
    handler: async (msg: EdemMsg) => {
      if (msg.type === "request") {
        const moduleProxy = edem[msg.module] as Record<string, (input: unknown) => Promise<unknown>>
        if (!moduleProxy) {
          for (const send of sendToWebview) {
            send({ type: "response", id: msg.id, error: `Module "${msg.module}" not found` })
          }
          return
        }
        try {
          const result = await moduleProxy[msg.proc](msg.input)
          for (const send of sendToWebview) {
            send({ type: "response", id: msg.id, result })
          }
        } catch (err) {
          for (const send of sendToWebview) {
            send({
              type: "response",
              id: msg.id,
              error: err instanceof Error ? err.message : String(err),
            })
          }
        }
      } else if (msg.type === "event") {
        for (const handler of onWebviewEventHandlers) {
          handler(msg.name, msg.payload as Record<string, unknown>)
        }
      }
    },
    attachWebview(webview: { rpc?: { send?: { edem?: (msg: EdemMsg) => void } } }) {
      const send = webview.rpc?.send?.edem
      if (send) {
        sendToWebview.length = 0
        sendToWebview.push(send)
      }
    },
    onWebviewEvent(handler: (name: string, payload: Record<string, unknown>) => void) {
      onWebviewEventHandlers.push(handler)
    },
  }
}
