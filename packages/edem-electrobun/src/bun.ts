import { getModuleSubscriptions } from "@exodus/edem-core"
import type { EdemMsg } from "./types"

interface EdemModule {
  _name: string
  _procs: Record<string, { kind: string }>
}

// ── Bun bridge ───────────────────────────────────────────────────────────────

export function createBunEdemBridge(
  edem: Record<string, Record<string, unknown>>,
  modules: EdemModule[],
) {
  const sendToWebview: ((msg: EdemMsg) => void)[] = []

  for (const mod of modules) {
    const moduleProxy = edem[mod._name] as Record<string, (arg: unknown) => unknown>
    const subscriptions = getModuleSubscriptions(
      mod as Parameters<typeof getModuleSubscriptions>[0],
    )

    for (const subName of subscriptions) {
      moduleProxy[subName]((event: unknown) => {
        for (const send of sendToWebview) {
          send({ type: "event", module: mod._name, name: subName, payload: event })
        }
      })
    }
  }

  return {
    handler: async (msg: EdemMsg) => {
      if (msg.type !== "request") return

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
    },
    attachWebview(webview: { rpc?: { send?: { edem?: (msg: EdemMsg) => void } } }) {
      const send = webview.rpc?.send?.edem
      if (send) {
        sendToWebview.length = 0
        sendToWebview.push(send)
      }
    },
  }
}
