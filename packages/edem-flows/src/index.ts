import { z } from "zod"
import { createEdemModule, type InferModuleAPI } from "@exodus/edem-core"
import type { dataModule } from "@exodus/edem-data"

type EdemData = InferModuleAPI<typeof dataModule>

const COLLECTION_ID = "flows"

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
  status: z.enum(["pending", "running", "success", "error", "cancelled"]),
  trigger: z.record(z.string(), z.unknown()).optional(),
  variables: z.record(z.string(), z.unknown()).optional(),
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
            collection_id: COLLECTION_ID,
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
          const runId = crypto.randomUUID()
          const now = Date.now()

          const run: z.infer<typeof runSchema> = {
            id: runId,
            flow_id: input.flow_id,
            status: "running",
            trigger: input.trigger_data,
            variables: {},
            started_at: now,
            completed_at: null,
          }
          await emit.runStarted(run)

          try {
            const result = await executeFlow(flow)
            const completedRun: z.infer<typeof runSchema> = {
              ...run,
              status: "success",
              variables: result,
              completed_at: Date.now(),
            }
            await emit.runCompleted(completedRun)
            return { run_id: runId, status: "success" }
          } catch (err) {
            const errorRun: z.infer<typeof runSchema> = {
              ...run,
              status: "error",
              error: err instanceof Error ? err.message : String(err),
              completed_at: Date.now(),
            }
            await emit.runCompleted(errorRun)
            return { run_id: runId, status: "error" }
          }
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
          const { items } = await data.queryItems({ collection_id: COLLECTION_ID })
          return { flows: items.map(parseFlow) }
        },
      }),
  (edem) => {
    const { data } = edem as { data: EdemData }
    dataRef = data
    ensureFlowsCollection(data).catch(console.error)
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

async function ensureFlowsCollection(data: EdemData) {
  try {
    const { collection } = await data.getCollection({ collection_id: COLLECTION_ID })
    if (collection) return

    await data.createCollection({
      id: COLLECTION_ID,
      name: "Flows",
      fields: [
        { name: "name", type: "string", required: true },
        { name: "trigger", type: "json", required: true },
        { name: "nodes", type: "json" },
        { name: "edges", type: "json" },
        { name: "meta", type: "json" },
      ],
    })
  } catch {
    // collection already exists
  }
}

async function executeFlow(flow: z.infer<typeof flowSchema>): Promise<Record<string, unknown>> {
  const variables: Record<string, unknown> = {}

  if (flow.nodes.length === 0) return variables

  const nodeMap = new Map(flow.nodes.map((n) => [n.id, n]))
  const adjacency = new Map<string, string[]>()

  for (const edge of flow.edges) {
    if (!adjacency.has(edge.source)) {
      adjacency.set(edge.source, [])
    }
    adjacency.get(edge.source)!.push(edge.target)
  }

  const startNode = flow.nodes[0]
  if (!startNode) return variables

  const queue: string[] = [startNode.id]
  const visited = new Set<string>()

  while (queue.length > 0) {
    const nodeId = queue.shift()!
    if (visited.has(nodeId)) continue
    visited.add(nodeId)

    const node = nodeMap.get(nodeId)
    if (!node) continue

    variables[nodeId] = { type: node.type, data: node.data, executed_at: Date.now() }

    const nextNodes = adjacency.get(nodeId) ?? []
    queue.push(...nextNodes)
  }

  return variables
}

export default flowsModule
