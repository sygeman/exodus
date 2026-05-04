import type { EdemWorkerFactory } from "@exodus/edem-core"
import type { EdemMsg } from "./types"

// ── Webview bridge ───────────────────────────────────────────────────────────

export function createWebviewEdemBridge() {
  const pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()
  const eventHandlers = new Map<string, Map<string, ((event: unknown) => void)[]>>()

  let sendToBun: ((msg: EdemMsg) => void) | null = null

  let requestId = 0

  const workerFactory: EdemWorkerFactory = (ctx) => {
    const localHandlers = new Map<string, ((event: unknown) => void)[]>()

    if (!eventHandlers.has(ctx.name)) {
      eventHandlers.set(ctx.name, new Map())
    }
    const moduleHandlers = eventHandlers.get(ctx.name)!

    return {
      async request(proc: string, input: unknown): Promise<unknown> {
        if (!sendToBun) throw new Error("[edem-rpc] Not connected to bun")

        const id = `${ctx.name}:${proc}:${++requestId}`
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            pending.delete(id)
            reject(new Error(`[edem-rpc] Timeout for ${ctx.name}.${proc}`))
          }, 30_000)

          pending.set(id, {
            resolve: (v) => {
              clearTimeout(timeout)
              resolve(v)
            },
            reject: (e) => {
              clearTimeout(timeout)
              reject(e)
            },
          })

          sendToBun!({ type: "request", module: ctx.name, proc, input, id })
        })
      },

      async emit(name: string, event: unknown): Promise<void> {
        if (!sendToBun) return
        sendToBun({ type: "event", module: ctx.name, name, payload: event })
      },

      subscribe(name: string, handler: (event: unknown) => void): () => void {
        if (!localHandlers.has(name)) localHandlers.set(name, [])
        localHandlers.get(name)!.push(handler)

        if (!moduleHandlers.has(name)) moduleHandlers.set(name, [])
        moduleHandlers.get(name)!.push(handler)

        return () => {
          const local = localHandlers.get(name)
          if (local) {
            const idx = local.indexOf(handler)
            if (idx !== -1) local.splice(idx, 1)
          }
          const mod = moduleHandlers.get(name)
          if (mod) {
            const idx = mod.indexOf(handler)
            if (idx !== -1) mod.splice(idx, 1)
          }
        }
      },
    }
  }

  return {
    workerFactory,
    handler: (msg: EdemMsg) => {
      if (msg.type === "response") {
        const p = pending.get(msg.id)
        if (p) {
          pending.delete(msg.id)
          if (msg.error) {
            p.reject(new Error(msg.error))
          } else {
            p.resolve(msg.result)
          }
        }
      }
      if (msg.type === "event") {
        const moduleHandlers = eventHandlers.get(msg.module)
        if (moduleHandlers) {
          const handlers = moduleHandlers.get(msg.name)
          if (handlers) {
            for (const h of handlers) h(msg.payload)
          }
        }
      }
    },
    attachBun(send: (msg: EdemMsg) => void) {
      sendToBun = send
    },
  }
}
