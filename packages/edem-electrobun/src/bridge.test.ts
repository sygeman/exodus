import { describe, expect, it } from "bun:test"
import { createEdem, createEdemModule, createEdemProxy } from "@exodus/edem-core"
import { z } from "zod"
import { createBunEdemBridge } from "./bun"
import { createWebviewEdemBridge } from "./webview"
import type { EdemMsg } from "./types"

const testModule = createEdemModule("test", (m) =>
  m
    .context(async () => ({}))
    .subscription("itemCreated", { output: z.object({ id: z.string(), name: z.string() }) })
    .mutation("createItem", {
      input: z.object({ name: z.string() }),
      output: z.object({ id: z.string() }),
      resolve: async ({ input, emit }) => {
        const item = { id: crypto.randomUUID(), name: input.name }
        await emit.itemCreated(item)
        return { id: item.id }
      },
    }),
)

function createBridgePair() {
  const edem = createEdem([testModule], {})
  const bunBridge = createBunEdemBridge(edem, [testModule])
  const webviewBridge = createWebviewEdemBridge()

  bunBridge.attachWebview({
    rpc: { send: { edem: (msg: EdemMsg) => webviewBridge.handler(msg) } },
  })
  webviewBridge.attachBun((msg: EdemMsg) => bunBridge.handler(msg))

  return { edem, webviewBridge }
}

describe("edem bridge", () => {
  it("request/response works", async () => {
    const { webviewBridge } = createBridgePair()
    const worker = webviewBridge.workerFactory({
      name: "test",
      procs: new Map(),
      subHandlers: new Map(),
      getCtx: async () => ({}),
    })
    const result = await worker.request("createItem", { name: "hello" })
    expect(result).toHaveProperty("id")
  })

  it("subscription via worker directly", async () => {
    const { webviewBridge } = createBridgePair()
    const worker = webviewBridge.workerFactory({
      name: "test",
      procs: new Map(),
      subHandlers: new Map(),
      getCtx: async () => ({}),
    })

    const received: unknown[] = []
    worker.subscribe("itemCreated", (event) => {
      received.push(event)
    })

    await worker.request("createItem", { name: "direct" })
    expect(received.length).toBe(1)
    expect(received[0]).toMatchObject({ name: "direct" })
  })

  it("subscription via createEdemProxy", async () => {
    const { webviewBridge } = createBridgePair()

    type TestAPI = {
      test: {
        createItem: (input: { name: string }) => Promise<{ id: string }>
        itemCreated: (handler: (args: { event: { id: string; name: string } }) => void) => void
      }
    }

    const proxy = createEdemProxy<TestAPI>(webviewBridge.workerFactory)
    const received: unknown[] = []
    proxy.test.itemCreated(({ event }) => {
      received.push(event)
    })

    await proxy.test.createItem({ name: "proxy" })
    expect(received.length).toBe(1)
    expect(received[0]).toMatchObject({ name: "proxy" })
  })
})
