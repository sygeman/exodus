import { describe, expect, it } from "bun:test"
import { z } from "zod"
import { createEdem, createEdemModule, createLocalEdemWorker } from "./edem"
import type { EdemWorker, EdemWorkerFactory, EdemWorkerContext } from "./edem"

function createDatabase() {
  const collections = new Map<string, { id: string; name: string }>()
  return {
    createCollection: async (name: string) => {
      const id = crypto.randomUUID()
      const collection = { id, name }
      collections.set(id, collection)
      return collection
    },
    getCollection: async (id: string) => {
      return collections.get(id) ?? null
    },
  }
}

const collectionModule = createEdemModule(
  "collection",
  (module) => {
    return module
      .context(async () => {
        const db = await createDatabase()
        return { db }
      })
      .subscription("collectionCreated", {
        output: z.object({
          id: z.string(),
          name: z.string(),
        }),
      })
      .mutation("createCollection", {
        input: z.object({
          name: z.string(),
        }),
        output: z.object({
          id: z.string(),
        }),
        resolve: async ({ input, ctx, emit }) => {
          const collection = await ctx.db.createCollection(input.name)

          await emit.collectionCreated({
            id: collection.id,
            name: collection.name,
          })

          return {
            id: collection.id,
          }
        },
      })
      .query("getCollection", {
        input: z.object({
          id: z.string(),
        }),
        output: z.object({
          collection: z.object({ id: z.string(), name: z.string() }).nullable(),
        }),
        resolve: async ({ input, ctx }) => {
          return {
            collection: await ctx.db.getCollection(input.id),
          }
        },
      })
  },
  (edem) => {
    edem.flows.flowCompleted(async ({ event }: { event: { name: string } }) => {
      edem.collection.createCollection({
        name: `flow-${event.name}`,
      })
    })
  },
)

const flowsModule = createEdemModule("flows", (module) => {
  return module
    .subscription("flowCompleted", {
      output: z.object({
        flowId: z.string(),
        name: z.string(),
        result: z.object({ ok: z.boolean() }),
      }),
    })
    .mutation("runFlow", {
      input: z.object({
        name: z.string(),
      }),
      output: z.object({
        flowId: z.string(),
      }),
      resolve: async ({ input, emit }) => {
        const flowId = crypto.randomUUID()

        await emit.flowCompleted({
          flowId,
          name: input.name,
          result: { ok: true },
        })

        return { flowId }
      },
    })
})

describe("Edem", () => {
  it("runs mutation and query", async () => {
    const edem = createEdem([collectionModule, flowsModule])

    const { id } = await edem.collection.createCollection({ name: "Projects" })
    expect(id).toMatch(/^[0-9a-f-]{36}$/i)

    const { collection } = await edem.collection.getCollection({ id })
    expect(collection?.name).toBe("Projects")
  })

  it("subscribes to events", async () => {
    const edem = createEdem([collectionModule, flowsModule])
    const events: string[] = []

    edem.collection.collectionCreated(async ({ event }) => {
      events.push(event.name)
    })

    await edem.collection.createCollection({ name: "Test" })
    expect(events).toEqual(["Test"])
  })

  it("cross-module reactions", async () => {
    const edem = createEdem([collectionModule, flowsModule])
    const created: string[] = []

    edem.collection.collectionCreated(async ({ event }) => {
      created.push(event.name)
    })

    await edem.flows.runFlow({ name: "sync-data" })
    expect(created).toEqual(["flow-sync-data"])
  })

  it("returns typed results", async () => {
    const edem = createEdem([collectionModule, flowsModule])

    const { flowId } = await edem.flows.runFlow({ name: "test" })
    expect(flowId).toMatch(/^[0-9a-f-]{36}$/i)
  })
})

describe("EdemWorker", () => {
  it("uses custom worker factory", async () => {
    const calls: string[] = []

    const factory: EdemWorkerFactory = (ctx) => {
      const local = createLocalEdemWorker(ctx)
      return {
        async request(name, input) {
          calls.push(`request:${name}`)
          return local.request(name, input)
        },
        async emit(name, event) {
          calls.push(`emit:${name}`)
          return local.emit(name, event)
        },
        subscribe(name, handler) {
          calls.push(`subscribe:${name}`)
          return local.subscribe(name, handler)
        },
      }
    }

    const edem = createEdem([collectionModule, flowsModule], {}, factory)

    edem.collection.collectionCreated(async () => {})
    await edem.collection.createCollection({ name: "Test" })
    await edem.collection.getCollection({ id: "fake" })

    expect(calls).toContain("subscribe:collectionCreated")
    expect(calls).toContain("request:createCollection")
    expect(calls).toContain("request:getCollection")
  })

  it("receives correct worker context", async () => {
    const contexts = new Map<string, EdemWorkerContext>()

    const factory: EdemWorkerFactory = (ctx) => {
      contexts.set(ctx.name, ctx)
      return createLocalEdemWorker(ctx)
    }

    createEdem([collectionModule, flowsModule], {}, factory)

    const collectionCtx = contexts.get("collection")!
    expect(collectionCtx).toBeDefined()
    expect(collectionCtx.procs.has("createCollection")).toBe(true)
    expect(collectionCtx.procs.has("getCollection")).toBe(true)
    expect(collectionCtx.procs.has("collectionCreated")).toBe(true)
    expect(collectionCtx.subHandlers.has("collectionCreated")).toBe(true)

    const flowsCtx = contexts.get("flows")!
    expect(flowsCtx).toBeDefined()
    expect(flowsCtx.procs.has("runFlow")).toBe(true)
    expect(flowsCtx.procs.has("flowCompleted")).toBe(true)
  })

  it("custom worker can intercept and transform requests", async () => {
    const factory: EdemWorkerFactory = (ctx) => {
      const local = createLocalEdemWorker(ctx)
      return {
        async request(name, input) {
          const result = await local.request(name, input)
          return { ...(result as object), intercepted: true }
        },
        async emit(name, event) {
          return local.emit(name, event)
        },
        subscribe(name, handler) {
          return local.subscribe(name, handler)
        },
      }
    }

    const edem = createEdem([collectionModule, flowsModule], {}, factory)
    const result = await edem.collection.createCollection({ name: "Test" })

    expect(result).toHaveProperty("id")
    expect(result).toHaveProperty("intercepted", true)
  })

  it("worker emit dispatches to subscribed handlers", async () => {
    const workers = new Map<string, EdemWorker>()

    const factory: EdemWorkerFactory = (ctx) => {
      const worker = createLocalEdemWorker(ctx)
      workers.set(ctx.name, worker)
      return worker
    }

    const edem = createEdem([collectionModule, flowsModule], {}, factory)
    const received: unknown[] = []

    edem.collection.collectionCreated(async ({ event }) => {
      received.push(event)
    })

    const collectionWorker = workers.get("collection")!
    await collectionWorker.emit("collectionCreated", { id: "1", name: "External" })
    expect(received).toEqual([{ id: "1", name: "External" }])
  })

  it("createLocalEdemWorker is the default", async () => {
    const edem = createEdem([collectionModule, flowsModule])

    const { id } = await edem.collection.createCollection({ name: "Default" })
    expect(id).toMatch(/^[0-9a-f-]{36}$/i)
  })
})
