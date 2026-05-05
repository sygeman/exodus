import { z } from "zod"
import { createEdemModule, type InferModuleAPI } from "@exodus/edem-core"
import type { dataModule } from "@exodus/edem-data"
import { executeFlow, type Flow } from "./engine"

type EdemData = InferModuleAPI<typeof dataModule>

const FLOWS_COLLECTION = "flows"
const RUNS_COLLECTION = "flow_runs"

let dataRef: EdemData | null = null

const triggerSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("event"),
    event: z.string(),
    filter: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    type: z.literal("schedule"),
    cron: z.string(),
  }),
  z.object({
    type: z.literal("manual"),
  }),
  z.object({
    type: z.literal("webhook"),
    path: z.string(),
  }),
])

const nodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
  data: z.record(z.string(), z.unknown()).optional(),
})

const edgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().optional(),
  targetHandle: z.string().optional(),
  condition: z.string().optional(),
  label: z.string().optional(),
})

const flowSchema = z.object({
  id: z.string(),
  name: z.string(),
  trigger: triggerSchema,
  nodes: z.array(nodeSchema),
  edges: z.array(edgeSchema),
  meta: z.record(z.string(), z.unknown()).optional(),
})

const runSchema = z.object({
  id: z.string(),
  flow_id: z.string(),
  status: z.enum(["pending", "running", "waiting", "completed", "error", "cancelled"]),
  input: z.record(z.string(), z.unknown()).optional(),
  output: z.record(z.string(), z.unknown()).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
  waiting_node_id: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
  started_at: z.number(),
  completed_at: z.number().nullable().optional(),
})

function getData(): EdemData {
  if (!dataRef) throw new Error("edem-flows: data module not initialized")
  return dataRef
}

export const flowsModule = createEdemModule(
  "flows",
  (module) =>
    module
      .subscription("flowCreated", { output: flowSchema })
      .subscription("flowUpdated", { output: flowSchema })
      .subscription("flowDeleted", { output: z.object({ flow_id: z.string() }) })
      .subscription("runStarted", { output: runSchema })
      .subscription("runCompleted", { output: runSchema })
      .subscription("runUpdated", { output: runSchema })
      .mutation("createFlow", {
        input: z.object({
          name: z.string(),
          trigger: triggerSchema,
          nodes: z.array(nodeSchema).optional(),
          edges: z.array(edgeSchema).optional(),
          meta: z.record(z.string(), z.unknown()).optional(),
        }),
        output: z.object({ flow_id: z.string() }),
        resolve: async ({ input, emit }) => {
          const data = getData()

          const { id } = await data.createItem({
            collection_id: FLOWS_COLLECTION,
            data: {
              name: input.name,
              trigger: input.trigger,
              nodes: input.nodes ?? [],
              edges: input.edges ?? [],
              meta: input.meta ?? {},
            },
          })

          const flow: z.infer<typeof flowSchema> = {
            id,
            name: input.name,
            trigger: input.trigger,
            nodes: input.nodes ?? [],
            edges: input.edges ?? [],
            meta: input.meta,
          }
          await emit.flowCreated(flow)

          return { flow_id: id }
        },
      })
      .mutation("updateFlow", {
        input: z.object({
          flow_id: z.string(),
          name: z.string().optional(),
          trigger: triggerSchema.optional(),
          nodes: z.array(nodeSchema).optional(),
          edges: z.array(edgeSchema).optional(),
          meta: z.record(z.string(), z.unknown()).optional(),
        }),
        output: z.object({ success: z.boolean() }),
        resolve: async ({ input, emit }) => {
          const data = getData()
          const { flow_id, ...updates } = input

          const { item } = await data.getItem({ item_id: flow_id })
          if (!item) throw new Error(`Flow ${flow_id} not found`)

          await data.updateItem({ item_id: flow_id, data: updates })

          const { item: updated } = await data.getItem({ item_id: flow_id })
          if (updated) {
            const flow = parseFlow(updated)
            await emit.flowUpdated(flow)
          }

          return { success: true }
        },
      })
      .mutation("deleteFlow", {
        input: z.object({ flow_id: z.string() }),
        output: z.object({ success: z.boolean() }),
        resolve: async ({ input, emit }) => {
          const data = getData()
          await data.deleteItem({ item_id: input.flow_id })
          await emit.flowDeleted({ flow_id: input.flow_id })
          return { success: true }
        },
      })
      .mutation("runFlow", {
        input: z.object({
          flow_id: z.string(),
          trigger_data: z.record(z.string(), z.unknown()).optional(),
        }),
        output: z.object({
          run_id: z.string(),
          status: z.string(),
        }),
        resolve: async ({ input, emit }) => {
          const data = getData()

          const { item } = await data.getItem({ item_id: input.flow_id })
          if (!item) throw new Error(`Flow ${input.flow_id} not found`)

          const flow = parseFlow(item)
          const now = Date.now()

          const { id: runId } = await data.createItem({
            collection_id: RUNS_COLLECTION,
            data: {
              flow_id: input.flow_id,
              status: "running",
              input: input.trigger_data ?? {},
              started_at: now,
            },
          })

          const run: z.infer<typeof runSchema> = {
            id: runId,
            flow_id: input.flow_id,
            status: "running",
            input: input.trigger_data,
            started_at: now,
            completed_at: null,
          }

          await emit.runStarted(run)

          try {
            const result = await executeFlow(flow as Flow, input.trigger_data ?? {})

            if (result.status === "waiting") {
              await data.updateItem({
                item_id: runId,
                data: {
                  status: "waiting",
                  context: result.context as unknown as Record<string, unknown>,
                  waiting_node_id: result.waitingNodeId,
                },
              })

              const waitingRun: z.infer<typeof runSchema> = {
                ...run,
                status: "waiting",
                context: result.context as unknown as Record<string, unknown>,
                waiting_node_id: result.waitingNodeId,
              }
              await emit.runUpdated(waitingRun)
              return { run_id: runId, status: "waiting" }
            }

            await data.updateItem({
              item_id: runId,
              data: {
                status: result.status,
                output: result.context.node_outputs,
                completed_at: Date.now(),
              },
            })

            const completedRun: z.infer<typeof runSchema> = {
              ...run,
              status: result.status,
              output: result.context.node_outputs,
              completed_at: Date.now(),
            }
            await emit.runCompleted(completedRun)
            return { run_id: runId, status: result.status }
          } catch (err) {
            const error = err instanceof Error ? err.message : String(err)

            await data.updateItem({
              item_id: runId,
              data: {
                status: "error",
                error,
                completed_at: Date.now(),
              },
            })

            const errorRun: z.infer<typeof runSchema> = {
              ...run,
              status: "error",
              error,
              completed_at: Date.now(),
            }
            await emit.runCompleted(errorRun)
            return { run_id: runId, status: "error" }
          }
        },
      })
      .mutation("cancelRun", {
        input: z.object({ run_id: z.string() }),
        output: z.object({ success: z.boolean() }),
        resolve: async ({ input }) => {
          const data = getData()

          const { item } = await data.getItem({ item_id: input.run_id })
          if (!item) throw new Error(`Run ${input.run_id} not found`)

          if (item.data.status !== "running" && item.data.status !== "waiting") {
            throw new Error(`Run ${input.run_id} is not running or waiting`)
          }

          await data.updateItem({
            item_id: input.run_id,
            data: { status: "cancelled", completed_at: Date.now() },
          })

          return { success: true }
        },
      })
      .mutation("handleNodeCompleted", {
        input: z.object({
          run_id: z.string(),
          node_id: z.string(),
          output: z.record(z.string(), z.unknown()),
        }),
        output: z.object({ success: z.boolean() }),
        resolve: async ({ input, emit }) => {
          const data = getData()

          const { item } = await data.getItem({ item_id: input.run_id })
          if (!item) throw new Error(`Run ${input.run_id} not found`)

          if (item.data.status !== "waiting") {
            throw new Error(`Run ${input.run_id} is not waiting`)
          }

          if (item.data.waiting_node_id !== input.node_id) {
            throw new Error(`Run ${input.run_id} is not waiting for node ${input.node_id}`)
          }

          const flowItem = await data.getItem({ item_id: item.data.flow_id as string })
          if (!flowItem.item) throw new Error(`Flow ${item.data.flow_id} not found`)

          const flow = parseFlow(flowItem.item)
          const context = (item.data.context as Record<string, unknown>) ?? {}

          context.node_outputs =
            (context.node_outputs as Record<string, Record<string, unknown>>) ?? {}
          ;(context.node_outputs as Record<string, Record<string, unknown>>)[input.node_id] =
            input.output

          const result = await executeFlow(
            flow as Flow,
            (context.trigger_data as Record<string, unknown>) ?? {},
          )

          if (result.status === "waiting") {
            await data.updateItem({
              item_id: input.run_id,
              data: {
                status: "waiting",
                context: result.context as unknown as Record<string, unknown>,
                waiting_node_id: result.waitingNodeId,
              },
            })

            const waitingRun: z.infer<typeof runSchema> = {
              id: input.run_id,
              flow_id: item.data.flow_id as string,
              status: "waiting",
              context: result.context as unknown as Record<string, unknown>,
              waiting_node_id: result.waitingNodeId,
              started_at: item.data.started_at as number,
              completed_at: null,
            }
            await emit.runUpdated(waitingRun)
            return { success: true }
          }

          await data.updateItem({
            item_id: input.run_id,
            data: {
              status: result.status,
              output: result.context.node_outputs,
              completed_at: Date.now(),
            },
          })

          const completedRun: z.infer<typeof runSchema> = {
            id: input.run_id,
            flow_id: item.data.flow_id as string,
            status: result.status,
            output: result.context.node_outputs,
            completed_at: Date.now(),
            started_at: item.data.started_at as number,
          }
          await emit.runCompleted(completedRun)
          return { success: true }
        },
      })
      .mutation("handleNodeFailed", {
        input: z.object({
          run_id: z.string(),
          node_id: z.string(),
          error: z.string(),
        }),
        output: z.object({ success: z.boolean() }),
        resolve: async ({ input, emit }) => {
          const data = getData()

          const { item } = await data.getItem({ item_id: input.run_id })
          if (!item) throw new Error(`Run ${input.run_id} not found`)

          if (item.data.status !== "waiting") {
            throw new Error(`Run ${input.run_id} is not waiting`)
          }

          if (item.data.waiting_node_id !== input.node_id) {
            throw new Error(`Run ${input.run_id} is not waiting for node ${input.node_id}`)
          }

          await data.updateItem({
            item_id: input.run_id,
            data: {
              status: "error",
              error: input.error,
              completed_at: Date.now(),
            },
          })

          const errorRun: z.infer<typeof runSchema> = {
            id: input.run_id,
            flow_id: item.data.flow_id as string,
            status: "error",
            error: input.error,
            completed_at: Date.now(),
            started_at: item.data.started_at as number,
          }
          await emit.runCompleted(errorRun)
          return { success: true }
        },
      })
      .query("getFlow", {
        input: z.object({ flow_id: z.string() }),
        output: z.object({ flow: flowSchema.nullable() }),
        resolve: async ({ input }) => {
          const data = getData()
          const { item } = await data.getItem({ item_id: input.flow_id })
          if (!item) return { flow: null }
          return { flow: parseFlow(item) }
        },
      })
      .query("listFlows", {
        input: z.void(),
        output: z.object({ flows: z.array(flowSchema) }),
        resolve: async () => {
          const data = getData()
          const { items } = await data.queryItems({
            collection_id: FLOWS_COLLECTION,
          })
          return { flows: items.map(parseFlow) }
        },
      })
      .query("getRun", {
        input: z.object({ run_id: z.string() }),
        output: z.object({ run: runSchema.nullable() }),
        resolve: async ({ input }) => {
          const data = getData()
          const { item } = await data.getItem({ item_id: input.run_id })
          if (!item) return { run: null }
          return { run: parseRun(item) }
        },
      })
      .query("listRuns", {
        input: z.object({
          flow_id: z.string().optional(),
          status: z.string().optional(),
        }),
        output: z.object({ runs: z.array(runSchema) }),
        resolve: async ({ input }) => {
          const data = getData()
          const { items } = await data.queryItems({
            collection_id: RUNS_COLLECTION,
          })

          let runs = items.map(parseRun)

          if (input.flow_id) {
            runs = runs.filter((r) => r.flow_id === input.flow_id)
          }
          if (input.status) {
            runs = runs.filter((r) => r.status === input.status)
          }

          return { runs }
        },
      }),
  (edem) => {
    const { data } = edem as { data: EdemData }
    dataRef = data
    ensureCollections(data).catch(console.error)
  },
)

function parseFlow(item: {
  id: string
  collection_id: string
  data: Record<string, unknown>
}): z.infer<typeof flowSchema> {
  return {
    id: item.id,
    name: item.data.name as string,
    trigger: item.data.trigger as z.infer<typeof triggerSchema>,
    nodes: (item.data.nodes as z.infer<typeof nodeSchema>[]) ?? [],
    edges: (item.data.edges as z.infer<typeof edgeSchema>[]) ?? [],
    meta: item.data.meta as Record<string, unknown> | undefined,
  }
}

function parseRun(item: {
  id: string
  collection_id: string
  data: Record<string, unknown>
}): z.infer<typeof runSchema> {
  return {
    id: (item.data.id as string) ?? item.id,
    flow_id: item.data.flow_id as string,
    status: item.data.status as z.infer<typeof runSchema>["status"],
    input: item.data.input as Record<string, unknown> | undefined,
    output: item.data.output as Record<string, unknown> | undefined,
    context: item.data.context as Record<string, unknown> | undefined,
    waiting_node_id: (item.data.waiting_node_id as string) ?? null,
    error: (item.data.error as string) ?? null,
    started_at: item.data.started_at as number,
    completed_at: (item.data.completed_at as number) ?? null,
  }
}

async function ensureCollections(data: EdemData) {
  try {
    const { collection: flowsCol } = await data.getCollection({
      collection_id: FLOWS_COLLECTION,
    })
    if (!flowsCol) {
      await data.createCollection({
        id: FLOWS_COLLECTION,
        name: "Flows",
        fields: [
          { name: "name", type: "string", required: true },
          { name: "trigger", type: "json", required: true },
          { name: "nodes", type: "json" },
          { name: "edges", type: "json" },
          { name: "meta", type: "json" },
        ],
      })
    }
  } catch {
    // collection already exists
  }

  try {
    const { collection: runsCol } = await data.getCollection({
      collection_id: RUNS_COLLECTION,
    })
    if (!runsCol) {
      await data.createCollection({
        id: RUNS_COLLECTION,
        name: "Flow Runs",
        fields: [
          { name: "flow_id", type: "string", required: true },
          { name: "status", type: "string", required: true },
          { name: "input", type: "json" },
          { name: "output", type: "json" },
          { name: "error", type: "string" },
          { name: "started_at", type: "number" },
          { name: "completed_at", type: "number" },
        ],
      })
    }
  } catch {
    // collection already exists
  }
}

export default flowsModule
