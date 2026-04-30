import { describe, expect, it } from "bun:test"
import { z } from "zod"
import { createEdem, createEdemModule } from "./edem"

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
