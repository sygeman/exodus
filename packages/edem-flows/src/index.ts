import { z } from "zod"
import {
  createEdemModule,
  getEdemProcedureCatalog,
  type InferModuleAPI,
  type ModuleProcedureCatalog,
  type ProcedureMetadata,
} from "@exodus/edem-core"
import type { dataModule } from "@exodus/edem-data"
import {
  executeFlow,
  validateFlowRunTransition,
  validateFlow,
  type NodeLifecycle,
  type NodeLifecycleEvent,
} from "./engine"
import { getProcedureReference, setEdemModules } from "./executors"
import {
  flowKindSchema,
  getFlowTriggerSource,
  parseEvery,
  triggerSchema,
  nodeSchema,
  edgeSchema,
  flowsManifestSchema,
  syncTriggerSourceToNodes,
  type FlowsManifest,
  type FlowManifest,
  type Trigger,
} from "./manifest"

export type { FlowsManifest, FlowManifest }

type EdemData = InferModuleAPI<typeof dataModule>

const FLOWS_COLLECTION = "flows"
const RUNS_COLLECTION = "flow_runs"
const RUN_NODES_COLLECTION = "flow_run_nodes"

let dataRef: EdemData | null = null
let procedureCatalogRef: ModuleProcedureCatalog[] | null = null

class AsyncMutex {
  private locks = new Map<string, Promise<void>>()

  async acquire(key: string): Promise<() => void> {
    const existing = this.locks.get(key)
    if (existing) await existing

    let release: () => void
    const promise = new Promise<void>((resolve) => {
      release = () => {
        resolve()
        this.locks.delete(key)
      }
    })
    this.locks.set(key, promise)
    return release!
  }
}

const bpMutex = new AsyncMutex()

const backpressureSchema = z.object({
  maxPending: z.number().optional(),
  maxConcurrent: z.number().optional(),
})

const procedureKindSchema = z.enum(["query", "mutation", "subscription"])

const serializedProcedureSchemaSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("none") }),
  z.object({ mode: z.literal("json-schema"), schema: z.unknown() }),
])

const procedureCatalogSchema = z.object({
  modules: z.array(
    z.object({
      module: z.string(),
      procedures: z.array(
        z.object({
          name: z.string(),
          kind: procedureKindSchema,
          inputSchema: serializedProcedureSchemaSchema,
          outputSchema: serializedProcedureSchemaSchema,
        }),
      ),
    }),
  ),
})

const flowSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(["draft", "active", "paused", "archived"]),
  kind: flowKindSchema,
  trigger: triggerSchema.optional(),
  nodes: z.array(nodeSchema),
  edges: z.array(edgeSchema),
  valid: z.boolean(),
  validation_errors: z.array(z.string()),
  meta: z.record(z.string(), z.unknown()).optional(),
  backpressure: backpressureSchema.optional(),
})

const flowContextSchema = z.object({
  trigger_data: z.record(z.string(), z.unknown()),
  node_outputs: z.record(z.string(), z.record(z.string(), z.unknown())),
  flow_variables: z.record(z.string(), z.unknown()),
})

const runSchema = z.object({
  id: z.string(),
  flow_id: z.string(),
  status: z.enum(["pending", "running", "waiting", "completed", "error", "cancelled"]),
  input: z.record(z.string(), z.unknown()).optional(),
  output: z.record(z.string(), z.unknown()).optional(),
  context: flowContextSchema.optional(),
  waiting_node_id: z.string().nullable().optional(),
  timeout_at: z.number().nullable().optional(),
  error: z.string().nullable().optional(),
  parent_run_id: z.string().nullable().optional(),
  started_at: z.number(),
  completed_at: z.number().nullable().optional(),
})

const flowRunNodeSchema = z.object({
  id: z.string(),
  run_id: z.string(),
  node_id: z.string(),
  status: z.enum(["pending", "running", "completed", "failed"]),
  input: z.record(z.string(), z.unknown()).optional(),
  output: z.record(z.string(), z.unknown()).optional(),
  error: z.string().optional(),
  attempts: z.number(),
  started_at: z.number(),
  completed_at: z.number().optional(),
})

type FlowRecord = z.infer<typeof flowSchema>
type FlowKind = FlowRecord["kind"]
type FlowStatus = FlowRecord["status"]
type FlowNodeRecord = z.infer<typeof nodeSchema>
type FlowEdgeRecord = z.infer<typeof edgeSchema>

function getData(): EdemData {
  if (!dataRef) throw new Error("edem-flows: data module not initialized")
  return dataRef
}

function findProcedure(
  catalog: ModuleProcedureCatalog[],
  moduleName: string,
  procedureName: string,
): ProcedureMetadata | null {
  const moduleEntry = catalog.find((entry) => entry.module === moduleName)
  return moduleEntry?.procedures.find((proc) => proc.name === procedureName) ?? null
}

function validateProcedureReferences(
  flow: Pick<FlowRecord, "nodes">,
  catalog: ModuleProcedureCatalog[] | null,
): string[] {
  if (!catalog) return []

  const errors: string[] = []

  for (const node of flow.nodes) {
    const reference = getProcedureReference(node.type, node.data)

    if (node.type === "call" && !reference) {
      errors.push(`Call node "${node.id}" must specify module and procedure`)
      continue
    }

    if (!reference) continue

    const procedure = findProcedure(catalog, reference.module, reference.procedure)
    if (!procedure) {
      errors.push(
        `Node "${node.id}" references unknown procedure "${reference.module}.${reference.procedure}"`,
      )
      continue
    }

    if (procedure.kind === "subscription") {
      errors.push(
        `Node "${node.id}" references subscription "${reference.module}.${reference.procedure}"; use query or mutation`,
      )
    }
  }

  return errors
}

function getFlowValidationState(
  flow: Omit<FlowRecord, "valid" | "validation_errors">,
  catalog: ModuleProcedureCatalog[] | null,
): { valid: boolean; errors: string[] } {
  const structural = validateFlow(flow)
  const triggerErrors = validateTriggerConfiguration(flow, catalog)
  const procedureErrors = validateProcedureReferences(flow, catalog)
  const errors = [...structural.errors, ...triggerErrors, ...procedureErrors]

  return {
    valid: errors.length === 0,
    errors,
  }
}

function validateTriggerConfiguration(
  flow: Pick<FlowRecord, "kind" | "nodes">,
  catalog: ModuleProcedureCatalog[] | null,
): string[] {
  if (flow.kind !== "flow") {
    return []
  }

  const trigger = getFlowTriggerSource(flow)
  if (!trigger) {
    return ["Trigger node must specify a valid source"]
  }

  switch (trigger.type) {
    case "event": {
      const errors = trigger.event.trim() === "" ? ["Trigger event source must not be empty"] : []

      if (!catalog || !trigger.event.includes(".")) {
        return errors
      }

      const separator = trigger.event.indexOf(".")
      const moduleName = trigger.event.slice(0, separator)
      const procedureName = trigger.event.slice(separator + 1)
      const procedure = findProcedure(catalog, moduleName, procedureName)

      if (!procedure) {
        errors.push(`Trigger event source references unknown subscription "${trigger.event}"`)
        return errors
      }

      if (procedure.kind !== "subscription") {
        errors.push(`Trigger event source "${trigger.event}" must reference a subscription`)
      }

      return errors
    }
    case "schedule": {
      const errors: string[] = []

      try {
        parseEvery(trigger.every)
      } catch {
        errors.push(`Schedule trigger has invalid every value "${trigger.every}"`)
      }

      if (trigger.at) {
        const match = /^(\d{2}):(\d{2})$/.exec(trigger.at)
        if (!match) {
          errors.push(`Schedule trigger has invalid at value "${trigger.at}"`)
        } else {
          const hours = Number(match[1])
          const minutes = Number(match[2])
          if (hours > 23 || minutes > 59) {
            errors.push(`Schedule trigger has invalid at value "${trigger.at}"`)
          }
        }
      }

      return errors
    }
    case "manual":
    default:
      return []
  }
}

function serializeProcedureCatalog(
  catalog: ModuleProcedureCatalog[] | null,
): z.infer<typeof procedureCatalogSchema> {
  return {
    modules: (catalog ?? [])
      .map((entry) => ({
        module: entry.module,
        procedures: entry.procedures
          .map((procedure) => ({
            name: procedure.name,
            kind: procedure.kind,
            inputSchema: serializeProcedureSchema(procedure.inputSchema, { io: "input" }),
            outputSchema: serializeProcedureSchema(procedure.outputSchema),
          }))
          .toSorted((left, right) => left.name.localeCompare(right.name)),
      }))
      .toSorted((left, right) => left.module.localeCompare(right.module)),
  }
}

function isVoidSchema(schema: unknown): boolean {
  if (!schema || typeof schema !== "object") {
    return false
  }

  const zod4Type = (schema as { _zod?: { def?: { type?: unknown } } })._zod?.def?.type
  if (zod4Type === "void") {
    return true
  }

  const legacyTypeName = (schema as { _def?: { typeName?: unknown } })._def?.typeName
  return legacyTypeName === "ZodVoid"
}

function serializeProcedureSchema(
  schema: unknown,
  options?: { io?: "input" | "output" },
): z.infer<typeof serializedProcedureSchemaSchema> {
  if (schema === null || schema === undefined || isVoidSchema(schema)) {
    return { mode: "none" }
  }

  return {
    mode: "json-schema",
    schema: JSON.parse(
      JSON.stringify(
        z.toJSONSchema(schema as z.ZodType, {
          io: options?.io,
          unrepresentable: "any",
        }),
      ),
    ),
  }
}

const DEFAULT_TRIGGER: Trigger = { type: "manual" }

function withTriggerNodes(input: {
  kind: FlowKind
  trigger?: Trigger
  nodes: FlowNodeRecord[]
  edges: FlowEdgeRecord[]
}): { trigger: Trigger | undefined; nodes: FlowNodeRecord[]; edges: FlowEdgeRecord[] } {
  if (input.kind !== "flow") {
    return {
      trigger: undefined,
      nodes: input.nodes,
      edges: input.edges,
    }
  }

  const trigger = input.trigger ?? getFlowTriggerSource({ kind: input.kind, nodes: input.nodes })

  if (!trigger) {
    return {
      trigger: undefined,
      nodes: input.nodes,
      edges: input.edges,
    }
  }

  const hasTriggerNode = input.nodes.some((node) => node.type === "trigger")
  if (hasTriggerNode) {
    return {
      trigger,
      nodes: syncTriggerSourceToNodes(input.nodes, trigger),
      edges: input.edges,
    }
  }

  const triggerId = input.nodes.some((node) => node.id === "trigger") ? "trigger_entry" : "trigger"
  const triggerNode: FlowNodeRecord = {
    id: triggerId,
    type: "trigger",
    position: { x: 0, y: 0 },
    data: { source: trigger },
  }
  const targetNodeIds = new Set(input.edges.map((edge) => edge.target))
  const rootNodes = input.nodes.filter((node) => !targetNodeIds.has(node.id))
  const triggerEdges = rootNodes.map((node) => ({
    id: `${triggerId}-${node.id}`,
    source: triggerId,
    target: node.id,
  }))

  return {
    trigger,
    nodes: [triggerNode, ...input.nodes],
    edges: [...triggerEdges, ...input.edges],
  }
}

function createDefaultFlowShape(kind: FlowKind): {
  nodes: FlowNodeRecord[]
  edges: FlowEdgeRecord[]
} {
  if (kind === "subflow") {
    return {
      nodes: [
        { id: "input", type: "input", position: { x: 0, y: 0 } },
        {
          id: "output",
          type: "output",
          position: { x: 240, y: 0 },
          data: { outputs: {} },
        },
      ],
      edges: [{ id: "input-output", source: "input", target: "output" }],
    }
  }

  return {
    nodes: [
      {
        id: "trigger",
        type: "trigger",
        position: { x: 0, y: 0 },
        data: { source: DEFAULT_TRIGGER },
      },
    ],
    edges: [],
  }
}

function createPersistedFlow(input: {
  id: string
  name: string
  status: FlowStatus
  kind: FlowKind
  trigger?: Trigger
  nodes: FlowNodeRecord[]
  edges: FlowEdgeRecord[]
  meta?: Record<string, unknown>
  backpressure?: { maxPending?: number; maxConcurrent?: number }
  procedureCatalog?: ModuleProcedureCatalog[] | null
}): FlowRecord {
  const normalized = withTriggerNodes({
    kind: input.kind,
    trigger: input.trigger,
    nodes: input.nodes,
    edges: input.edges,
  })

  const flow: Omit<FlowRecord, "valid" | "validation_errors"> = {
    id: input.id,
    name: input.name,
    status: input.status,
    kind: input.kind,
    trigger: normalized.trigger,
    nodes: normalized.nodes,
    edges: normalized.edges,
    meta: input.meta,
    backpressure: input.backpressure,
  }

  const validation = getFlowValidationState(flow, input.procedureCatalog ?? null)
  return {
    ...flow,
    valid: validation.valid,
    validation_errors: validation.errors,
  }
}

function withoutId<T extends { id: string }>(value: T): Omit<T, "id"> {
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "id")) as Omit<T, "id">
}

function toStoredFlowData(value: Omit<FlowRecord, "id">): Omit<FlowRecord, "id"> {
  return {
    ...value,
    trigger: undefined as never,
  }
}

function buildCreatedFlow(input: {
  name: string
  kind?: FlowKind
  trigger?: Trigger
  nodes?: FlowNodeRecord[]
  edges?: FlowEdgeRecord[]
  meta?: Record<string, unknown>
  backpressure?: { maxPending?: number; maxConcurrent?: number }
  procedureCatalog?: ModuleProcedureCatalog[] | null
}): Omit<FlowRecord, "id"> {
  const kind = input.kind ?? "flow"
  const defaults = createDefaultFlowShape(kind)
  const flow = createPersistedFlow({
    id: "",
    name: input.name,
    status: "draft",
    kind,
    trigger: input.trigger,
    nodes: input.nodes ?? defaults.nodes,
    edges: input.edges ?? defaults.edges,
    meta: input.meta ?? {},
    backpressure: input.backpressure,
    procedureCatalog: input.procedureCatalog,
  })

  return withoutId(flow)
}

function buildUpdatedFlow(
  existing: FlowRecord,
  input: {
    name?: string
    kind?: FlowKind
    trigger?: Trigger
    nodes?: FlowNodeRecord[]
    edges?: FlowEdgeRecord[]
    meta?: Record<string, unknown>
    backpressure?: { maxPending?: number; maxConcurrent?: number }
    procedureCatalog?: ModuleProcedureCatalog[] | null
  },
): Omit<FlowRecord, "id"> {
  const kind = input.kind ?? existing.kind
  const kindChanged = kind !== existing.kind
  const defaults = createDefaultFlowShape(kind)

  const flow = createPersistedFlow({
    id: existing.id,
    name: input.name ?? existing.name,
    status: existing.status,
    kind,
    trigger: input.trigger ?? existing.trigger,
    nodes: kindChanged ? defaults.nodes : (input.nodes ?? existing.nodes),
    edges: kindChanged ? defaults.edges : (input.edges ?? existing.edges),
    meta: input.meta ?? existing.meta,
    backpressure: input.backpressure ?? existing.backpressure,
    procedureCatalog: input.procedureCatalog,
  })

  return withoutId(flow)
}

type EmitFn = {
  runStarted: (run: z.infer<typeof runSchema>) => Promise<void>
  runCompleted: (run: z.infer<typeof runSchema>) => Promise<void>
  runUpdated: (run: z.infer<typeof runSchema>) => Promise<void>
  runNodeStarted: (node: z.infer<typeof flowRunNodeSchema>) => Promise<void>
  runNodeCompleted: (node: z.infer<typeof flowRunNodeSchema>) => Promise<void>
  nodeStarted: (event: { run_id: string; node_id: string }) => Promise<void>
  nodeCompleted: (event: {
    run_id: string
    node_id: string
    output: Record<string, unknown>
  }) => Promise<void>
}

function createLifecycleHandlers(data: EdemData, emit: EmitFn): NodeLifecycle {
  async function findRunningNode(runId: string, nodeId: string, attempts: number) {
    const { items } = await data.queryItems({
      collection_id: RUN_NODES_COLLECTION,
    })
    return items.find(
      (i) =>
        i.data.run_id === runId &&
        i.data.node_id === nodeId &&
        i.data.attempts === attempts &&
        i.data.status === "running",
    )
  }

  return {
    onNodeStarted: async (event: NodeLifecycleEvent) => {
      const { id: nodeRunId } = await data.createItem({
        collection_id: RUN_NODES_COLLECTION,
        data: {
          run_id: event.run_id,
          node_id: event.node_id,
          status: "running",
          input: event.input,
          attempts: event.attempts,
          started_at: event.started_at,
        },
      })
      const runNode: z.infer<typeof flowRunNodeSchema> = {
        id: nodeRunId,
        run_id: event.run_id,
        node_id: event.node_id,
        status: "running",
        input: event.input,
        attempts: event.attempts,
        started_at: event.started_at,
      }
      await emit.runNodeStarted(runNode)
      await emit.nodeStarted({ run_id: event.run_id, node_id: event.node_id })
    },
    onNodeCompleted: async (event: NodeLifecycleEvent) => {
      const existing = await findRunningNode(event.run_id, event.node_id, event.attempts)
      if (existing) {
        await data.updateItem({
          item_id: existing.id,
          data: {
            status: "completed",
            output: event.output,
            completed_at: event.completed_at,
          },
        })
        const runNode: z.infer<typeof flowRunNodeSchema> = {
          id: existing.id,
          run_id: event.run_id,
          node_id: event.node_id,
          status: "completed",
          input: event.input,
          output: event.output,
          attempts: event.attempts,
          started_at: event.started_at,
          completed_at: event.completed_at,
        }
        await emit.runNodeCompleted(runNode)
        await emit.nodeCompleted({
          run_id: event.run_id,
          node_id: event.node_id,
          output: event.output ?? {},
        })
      }
    },
    onNodeFailed: async (event: NodeLifecycleEvent) => {
      const existing = await findRunningNode(event.run_id, event.node_id, event.attempts)
      if (existing) {
        await data.updateItem({
          item_id: existing.id,
          data: {
            status: "failed",
            error: event.error,
            completed_at: event.completed_at,
          },
        })
        const runNode: z.infer<typeof flowRunNodeSchema> = {
          id: existing.id,
          run_id: event.run_id,
          node_id: event.node_id,
          status: "failed",
          input: event.input,
          error: event.error,
          attempts: event.attempts,
          started_at: event.started_at,
          completed_at: event.completed_at,
        }
        await emit.runNodeCompleted(runNode)
        await emit.nodeCompleted({
          run_id: event.run_id,
          node_id: event.node_id,
          output: event.output ?? {},
        })
      }
    },
  }
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
      .subscription("nodeStarted", {
        output: z.object({ run_id: z.string(), node_id: z.string() }),
      })
      .subscription("nodeCompleted", {
        output: z.object({
          run_id: z.string(),
          node_id: z.string(),
          output: z.record(z.string(), z.unknown()),
        }),
      })
      .subscription("runNodeStarted", {
        output: flowRunNodeSchema,
      })
      .subscription("runNodeCompleted", {
        output: flowRunNodeSchema,
      })
      .mutation("createFlow", {
        input: z.object({
          name: z.string(),
          kind: flowKindSchema.optional(),
          trigger: triggerSchema.optional(),
          nodes: z.array(nodeSchema).optional(),
          edges: z.array(edgeSchema).optional(),
          meta: z.record(z.string(), z.unknown()).optional(),
          backpressure: backpressureSchema.optional(),
        }),
        output: z.object({ flow_id: z.string() }),
        resolve: async ({ input, emit }) => {
          const data = getData()
          const flowData = buildCreatedFlow({
            ...input,
            procedureCatalog: procedureCatalogRef,
          })

          const { id } = await data.createItem({
            collection_id: FLOWS_COLLECTION,
            data: toStoredFlowData(flowData),
          })

          const flow: FlowRecord = {
            id,
            ...flowData,
          }
          await emit.flowCreated(flow)

          return { flow_id: id }
        },
      })
      .mutation("updateFlow", {
        input: z.object({
          flow_id: z.string(),
          name: z.string().optional(),
          kind: flowKindSchema.optional(),
          trigger: triggerSchema.optional(),
          nodes: z.array(nodeSchema).optional(),
          edges: z.array(edgeSchema).optional(),
          meta: z.record(z.string(), z.unknown()).optional(),
          backpressure: backpressureSchema.optional(),
        }),
        output: z.object({ success: z.boolean() }),
        resolve: async ({ input, emit }) => {
          const data = getData()
          const { flow_id, ...updates } = input

          const { item } = await data.getItem({ item_id: flow_id })
          if (!item) throw new Error(`Flow ${flow_id} not found`)

          const existing = parseFlow(item)
          const flowData = buildUpdatedFlow(existing, {
            ...updates,
            procedureCatalog: procedureCatalogRef,
          })

          await data.updateItem({ item_id: flow_id, data: toStoredFlowData(flowData) })

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

          const validation = getFlowValidationState(flow, procedureCatalogRef)
          if (!validation.valid) {
            throw new Error(`Invalid flow: ${validation.errors.join("; ")}`)
          }

          const now = Date.now()

          await data.updateItem({
            item_id: input.flow_id,
            data: { last_run_at: now },
          })

          const releaseLock = await bpMutex.acquire(input.flow_id)

          try {
            await checkBackpressure(data, flow, input.flow_id)

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

            const lifecycle = createLifecycleHandlers(data, emit)

            try {
              const result = await executeFlow(flow, input.trigger_data ?? {}, undefined, {
                run_id: runId,
                lifecycle,
              })

              if (result.status === "waiting") {
                const waitingNode = flow.nodes.find((n) => n.id === result.waitingNodeId)

                if (waitingNode?.type === "subflow") {
                  const subflowResult = await handleSubflow(
                    data,
                    emit,
                    flow,
                    run,
                    runId,
                    result,
                    waitingNode,
                    item,
                    lifecycle,
                  )
                  if (subflowResult) return subflowResult
                }

                await data.updateItem({
                  item_id: runId,
                  data: {
                    status: "waiting",
                    context: result.context,
                    waiting_node_id: result.waitingNodeId,
                    timeout_at: calculateTimeoutAt(flow, result.waitingNodeId),
                  },
                })

                const waitingRun: z.infer<typeof runSchema> = {
                  ...run,
                  status: "waiting",
                  context: result.context,
                  waiting_node_id: result.waitingNodeId,
                }
                await emit.runUpdated(waitingRun)
                return { run_id: runId, status: "waiting" }
              }

              await data.updateItem({
                item_id: runId,
                data: {
                  status: result.status,
                  output: extractFlowOutput(flow, result.context),
                  error: result.error ?? null,
                  waiting_node_id: null,
                  completed_at: Date.now(),
                },
              })

              const completedRun: z.infer<typeof runSchema> = {
                ...run,
                status: result.status,
                output: extractFlowOutput(flow, result.context),
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
            } finally {
              releaseLock()
            }
          } catch (err) {
            releaseLock()
            throw err
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

          const currentStatus = item.data.status as string
          if (!validateFlowRunTransition(currentStatus, "cancelled")) {
            throw new Error(`Cannot cancel run ${input.run_id} with status ${currentStatus}`)
          }

          await data.updateItem({
            item_id: input.run_id,
            data: { status: "cancelled", completed_at: Date.now() },
          })

          return { success: true }
        },
      })
      .mutation("deleteRuns", {
        input: z.object({ flow_id: z.string() }),
        output: z.object({ deleted: z.number() }),
        resolve: async ({ input }) => {
          const data = getData()

          const { items: runs } = await data.queryItems({
            collection_id: RUNS_COLLECTION,
          })
          const flowRuns = runs.filter((r) => r.data.flow_id === input.flow_id)

          let deleted = 0
          for (const run of flowRuns) {
            const { items: runNodes } = await data.queryItems({
              collection_id: RUN_NODES_COLLECTION,
            })
            const nodesForRun = runNodes.filter((n) => n.data.run_id === run.id)
            for (const node of nodesForRun) {
              await data.deleteItem({ item_id: node.id })
            }
            await data.deleteItem({ item_id: run.id })
            deleted++
          }

          return { deleted }
        },
      })
      .mutation("resumeRun", {
        input: z.object({ run_id: z.string() }),
        output: z.object({ success: z.boolean() }),
        resolve: async ({ input, emit }) => {
          const data = getData()

          const { item } = await data.getItem({ item_id: input.run_id })
          if (!item) throw new Error(`Run ${input.run_id} not found`)

          const currentStatus = item.data.status as string
          if (!validateFlowRunTransition(currentStatus, "running")) {
            throw new Error(`Cannot resume run ${input.run_id} with status ${currentStatus}`)
          }

          const flowItem = await data.getItem({ item_id: item.data.flow_id as string })
          if (!flowItem.item) throw new Error(`Flow ${item.data.flow_id} not found`)

          const flow = parseFlow(flowItem.item)
          const storedContext = (item.data.context ?? {}) as {
            trigger_data?: Record<string, unknown>
            node_outputs?: Record<string, Record<string, unknown>>
            flow_variables?: Record<string, unknown>
          }

          const restoredContext = {
            trigger_data: storedContext.trigger_data ?? {},
            node_outputs: storedContext.node_outputs ?? {},
            flow_variables: storedContext.flow_variables ?? {},
          }

          await data.updateItem({
            item_id: input.run_id,
            data: { status: "running" },
          })

          const runId = input.run_id
          const lifecycle = createLifecycleHandlers(data, emit)

          try {
            const result = await executeFlow(flow, restoredContext.trigger_data, restoredContext, {
              run_id: runId,
              lifecycle,
            })

            if (result.status === "waiting") {
              await data.updateItem({
                item_id: runId,
                data: {
                  status: "waiting",
                  context: result.context,
                  waiting_node_id: result.waitingNodeId,
                  timeout_at: calculateTimeoutAt(flow, result.waitingNodeId),
                },
              })

              const waitingRun: z.infer<typeof runSchema> = {
                id: runId,
                flow_id: item.data.flow_id as string,
                status: "waiting",
                context: result.context,
                waiting_node_id: result.waitingNodeId,
                started_at: item.data.started_at as number,
                completed_at: null,
              }
              await emit.runUpdated(waitingRun)
              return { success: true }
            }

            await data.updateItem({
              item_id: runId,
              data: {
                status: result.status,
                output: extractFlowOutput(flow, result.context),
                completed_at: Date.now(),
              },
            })

            const completedRun: z.infer<typeof runSchema> = {
              id: runId,
              flow_id: item.data.flow_id as string,
              status: result.status,
              output: extractFlowOutput(flow, result.context),
              completed_at: Date.now(),
              started_at: item.data.started_at as number,
            }
            await emit.runCompleted(completedRun)
            return { success: true }
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
              id: runId,
              flow_id: item.data.flow_id as string,
              status: "error",
              error,
              completed_at: Date.now(),
              started_at: item.data.started_at as number,
            }
            await emit.runCompleted(errorRun)
            return { success: true }
          }
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

          const currentStatus = item.data.status as string
          if (!validateFlowRunTransition(currentStatus, "completed")) {
            throw new Error(`Run ${input.run_id} has status ${currentStatus}, expected waiting`)
          }

          if (item.data.waiting_node_id !== input.node_id) {
            throw new Error(`Run ${input.run_id} is not waiting for node ${input.node_id}`)
          }

          const flowItem = await data.getItem({ item_id: item.data.flow_id as string })
          if (!flowItem.item) throw new Error(`Flow ${item.data.flow_id} not found`)

          const flow = parseFlow(flowItem.item)
          const storedContext = (item.data.context ?? {}) as {
            trigger_data?: Record<string, unknown>
            node_outputs?: Record<string, Record<string, unknown>>
            flow_variables?: Record<string, unknown>
          }

          const restoredContext = {
            trigger_data: storedContext.trigger_data ?? {},
            node_outputs: storedContext.node_outputs ?? {},
            flow_variables: storedContext.flow_variables ?? {},
          }
          restoredContext.node_outputs[input.node_id] = input.output

          const runId = input.run_id
          const lifecycle = createLifecycleHandlers(data, emit)

          const result = await executeFlow(flow, restoredContext.trigger_data, restoredContext, {
            run_id: runId,
            lifecycle,
          })

          if (result.status === "waiting") {
            await data.updateItem({
              item_id: input.run_id,
              data: {
                status: "waiting",
                context: result.context,
                waiting_node_id: result.waitingNodeId,
                timeout_at: calculateTimeoutAt(flow, result.waitingNodeId),
              },
            })

            const waitingRun: z.infer<typeof runSchema> = {
              id: input.run_id,
              flow_id: item.data.flow_id as string,
              status: "waiting",
              context: result.context,
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
              output: extractFlowOutput(flow, result.context),
              error: result.error ?? null,
              waiting_node_id: null,
              completed_at: Date.now(),
            },
          })

          const completedRun: z.infer<typeof runSchema> = {
            id: input.run_id,
            flow_id: item.data.flow_id as string,
            status: result.status,
            output: extractFlowOutput(flow, result.context),
            error: result.error ?? null,
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

          const currentStatus = item.data.status as string
          if (!validateFlowRunTransition(currentStatus, "error")) {
            throw new Error(`Run ${input.run_id} has status ${currentStatus}, expected waiting`)
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
      .mutation("applyManifest", {
        input: z.object({
          manifest: flowsManifestSchema,
        }),
        output: z.object({
          created: z.array(z.string()),
          updated: z.array(z.string()),
          skipped: z.array(z.string()),
          deleted: z.array(z.string()),
        }),
        resolve: async ({ input, emit }) => {
          const data = getData()
          const { manifest } = input

          const created: string[] = []
          const updated: string[] = []
          const skipped: string[] = []
          const deleted: string[] = []

          const { items: existingFlows } = await data.queryItems({
            collection_id: FLOWS_COLLECTION,
          })
          const existingByManifestId = new Map(
            existingFlows.map((f) => [f.data.manifest_id as string, f]),
          )

          const manifestIds = new Set(manifest.flows.map((f) => f.id))

          for (const flowDef of manifest.flows) {
            const existing = existingByManifestId.get(flowDef.id)

            if (existing) {
              const existingData = existing.data
              const hasChanges =
                existingData.name !== flowDef.name ||
                existingData.project_id !== null ||
                (existingData.kind as FlowKind | undefined) !== (flowDef.kind ?? "flow") ||
                !deepEqual(existingData.nodes, flowDef.nodes) ||
                !deepEqual(existingData.edges, flowDef.edges) ||
                !deepEqual(existingData.meta, flowDef.meta ?? {}) ||
                !deepEqual(existingData.backpressure, flowDef.backpressure)

              if (hasChanges) {
                const nextFlow = createPersistedFlow({
                  id: existing.id,
                  name: flowDef.name,
                  status: ((existing.data.status as FlowStatus | undefined) ??
                    "active") as FlowStatus,
                  kind: flowDef.kind ?? "flow",
                  nodes: flowDef.nodes,
                  edges: flowDef.edges,
                  meta: flowDef.meta ?? {},
                  backpressure: flowDef.backpressure,
                  procedureCatalog: procedureCatalogRef,
                })
                const flowData = toStoredFlowData(withoutId(nextFlow))

                await data.updateItem({
                  item_id: existing.id,
                  data: {
                    project_id: null,
                    ...flowData,
                  },
                })
                updated.push(flowDef.id)
                await emit.flowUpdated(nextFlow)
              } else {
                skipped.push(flowDef.id)
              }
            } else {
              const nextFlow = createPersistedFlow({
                id: "",
                name: flowDef.name,
                status: "active",
                kind: flowDef.kind ?? "flow",
                nodes: flowDef.nodes,
                edges: flowDef.edges,
                meta: flowDef.meta ?? {},
                backpressure: flowDef.backpressure,
                procedureCatalog: procedureCatalogRef,
              })
              const flowData = toStoredFlowData(withoutId(nextFlow))

              const { id } = await data.createItem({
                collection_id: FLOWS_COLLECTION,
                data: {
                  project_id: null,
                  manifest_id: flowDef.id,
                  ...flowData,
                },
              })
              created.push(flowDef.id)
              await emit.flowCreated({ ...nextFlow, id })
            }
          }

          for (const existing of existingFlows) {
            const mid = existing.data.manifest_id as string
            if (mid && !manifestIds.has(mid)) {
              await data.deleteItem({ item_id: existing.id })
              await emit.flowDeleted({ flow_id: existing.id })
              deleted.push(mid)
            }
          }

          return { created, updated, skipped, deleted }
        },
      })
      .query("getManifest", {
        input: z.void(),
        output: flowsManifestSchema,
        resolve: async () => {
          const data = getData()
          const { items } = await data.queryItems({
            collection_id: FLOWS_COLLECTION,
          })

          const flows = items.map((item) => {
            const flow = parseFlow(item)
            return {
              id: (item.data.manifest_id as string) ?? item.id,
              name: flow.name,
              kind: flow.kind,
              nodes: flow.nodes,
              edges: flow.edges,
              meta: flow.meta,
              backpressure: flow.backpressure,
            }
          })

          return { flows }
        },
      })
      .query("getProcedureCatalog", {
        input: z.void(),
        output: procedureCatalogSchema,
        resolve: async () => serializeProcedureCatalog(procedureCatalogRef),
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
        input: z
          .object({
            status: z.enum(["draft", "active", "paused", "archived"]).optional(),
            name: z.string().optional(),
          })
          .optional(),
        output: z.object({ flows: z.array(flowSchema) }),
        resolve: async ({ input }) => {
          const data = getData()
          const { items } = await data.queryItems({
            collection_id: FLOWS_COLLECTION,
          })
          let flows = items.map(parseFlow)

          if (input?.status) {
            flows = flows.filter((f) => f.status === input.status)
          }
          if (input?.name) {
            const nameLower = input.name.toLowerCase()
            flows = flows.filter((f) => f.name.toLowerCase().includes(nameLower))
          }

          return { flows }
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
      })
      .query("getRunNodes", {
        input: z.object({ run_id: z.string() }),
        output: z.object({ nodes: z.array(flowRunNodeSchema) }),
        resolve: async ({ input }) => {
          const data = getData()
          const { items } = await data.queryItems({
            collection_id: RUN_NODES_COLLECTION,
          })
          const nodes = items
            .filter((i) => i.data.run_id === input.run_id)
            .map((item) => ({
              id: item.id,
              run_id: item.data.run_id as string,
              node_id: item.data.node_id as string,
              status: item.data.status as z.infer<typeof flowRunNodeSchema>["status"],
              input: item.data.input as Record<string, unknown> | undefined,
              output: item.data.output as Record<string, unknown> | undefined,
              error: item.data.error as string | undefined,
              attempts: item.data.attempts as number,
              started_at: item.data.started_at as number,
              completed_at: item.data.completed_at as number | undefined,
            }))
          return { nodes }
        },
      }),
  async (edem) => {
    const modules = edem as Record<string, Record<string, unknown>>
    dataRef = modules.data as unknown as EdemData
    procedureCatalogRef = getEdemProcedureCatalog(edem)
    setEdemModules(modules)
    await ensureCollections(dataRef)
  },
)

const VALID_FLOW_STATUSES = ["draft", "active", "paused", "archived"] as const
const VALID_FLOW_KINDS = ["flow", "subflow"] as const
const VALID_RUN_STATUSES = [
  "pending",
  "running",
  "waiting",
  "completed",
  "error",
  "cancelled",
] as const

function toStr(val: unknown, fallback: string): string {
  return typeof val === "string" ? val : fallback
}

function toNum(val: unknown): number | null {
  return typeof val === "number" ? val : null
}

function parseFlow(item: {
  id: string
  collection_id: string
  data: Record<string, unknown>
}): FlowRecord {
  const status = toStr(item.data.status, "draft")
  const kind = toStr(item.data.kind, "flow")
  const nodes = (Array.isArray(item.data.nodes) ? item.data.nodes : []) as z.infer<
    typeof nodeSchema
  >[]
  const trigger = getFlowTriggerSource({ kind, nodes })

  const flow: Omit<FlowRecord, "valid" | "validation_errors"> = {
    id: item.id,
    name: toStr(item.data.name, ""),
    status: (VALID_FLOW_STATUSES as readonly string[]).includes(status)
      ? (status as FlowStatus)
      : "draft",
    kind: (VALID_FLOW_KINDS as readonly string[]).includes(kind) ? (kind as FlowKind) : "flow",
    trigger,
    nodes,
    edges: (Array.isArray(item.data.edges) ? item.data.edges : []) as z.infer<typeof edgeSchema>[],
    meta: (item.data.meta && typeof item.data.meta === "object" ? item.data.meta : undefined) as
      | Record<string, unknown>
      | undefined,
    backpressure: (item.data.backpressure && typeof item.data.backpressure === "object"
      ? item.data.backpressure
      : undefined) as { maxPending?: number; maxConcurrent?: number } | undefined,
  }

  const computed = getFlowValidationState(flow, procedureCatalogRef)
  const valid = procedureCatalogRef
    ? computed.valid
    : typeof item.data.valid === "boolean"
      ? item.data.valid
      : computed.valid
  const validation_errors = procedureCatalogRef
    ? computed.errors
    : Array.isArray(item.data.validation_errors)
      ? item.data.validation_errors.filter((error): error is string => typeof error === "string")
      : computed.errors

  return {
    ...flow,
    valid,
    validation_errors,
  }
}

function parseRun(item: {
  id: string
  collection_id: string
  data: Record<string, unknown>
}): z.infer<typeof runSchema> {
  const status = toStr(item.data.status, "pending")
  return {
    id: item.id,
    flow_id: toStr(item.data.flow_id, ""),
    status: (VALID_RUN_STATUSES as readonly string[]).includes(status)
      ? (status as z.infer<typeof runSchema>["status"])
      : "pending",
    input: (item.data.input && typeof item.data.input === "object"
      ? item.data.input
      : undefined) as Record<string, unknown> | undefined,
    output: (item.data.output && typeof item.data.output === "object"
      ? item.data.output
      : undefined) as Record<string, unknown> | undefined,
    context: (item.data.context && typeof item.data.context === "object"
      ? item.data.context
      : undefined) as z.infer<typeof flowContextSchema> | undefined,
    waiting_node_id: toStr(item.data.waiting_node_id, "") || null,
    timeout_at: toNum(item.data.timeout_at),
    error: toStr(item.data.error, "") || null,
    parent_run_id: toStr(item.data.parent_run_id, "") || null,
    started_at: typeof item.data.started_at === "number" ? item.data.started_at : Date.now(),
    completed_at: toNum(item.data.completed_at),
  }
}

/**
 * Extracts the flow output from execution context.
 * Subflows return only their output-node payload, while regular flows expose
 * all node outputs for debugging/transparency.
 */
function extractFlowOutput(
  flow: FlowRecord,
  context: { node_outputs: Record<string, Record<string, unknown>> },
): Record<string, unknown> {
  if (flow.kind !== "subflow") {
    return context.node_outputs
  }

  const outputNode = flow.nodes.find((n) => n.type === "output")
  if (outputNode && context.node_outputs[outputNode.id]) {
    const nodeOut = context.node_outputs[outputNode.id]
    return (nodeOut.outputs as Record<string, unknown>) ?? nodeOut
  }
  return context.node_outputs
}

function calculateTimeoutAt(
  flow: z.infer<typeof flowSchema>,
  waitingNodeId: string | undefined,
): number | null {
  if (!waitingNodeId) return null
  const node = flow.nodes.find((n) => n.id === waitingNodeId)
  if (!node?.timeout || node.timeout <= 0) return null
  return Date.now() + node.timeout
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || b === null || a === undefined || b === undefined) return false
  if (typeof a !== typeof b) return false
  if (typeof a !== "object") return false

  if (Array.isArray(a) !== Array.isArray(b)) return false

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    return a.every((item, i) => deepEqual(item, b[i]))
  }

  const objA = a as Record<string, unknown>
  const objB = b as Record<string, unknown>
  const keysA = Object.keys(objA)
  const keysB = Object.keys(objB)

  if (keysA.length !== keysB.length) return false

  for (const key of keysA) {
    if (!Object.hasOwn(objB, key)) return false
    if (!deepEqual(objA[key], objB[key])) return false
  }

  return true
}

async function checkBackpressure(data: EdemData, flow: z.infer<typeof flowSchema>, flowId: string) {
  if (!flow.backpressure) return

  const { items: allRuns } = await data.queryItems({
    collection_id: RUNS_COLLECTION,
  })
  const flowRuns = allRuns.filter((r) => r.data.flow_id === flowId)

  if (flow.backpressure.maxConcurrent !== undefined) {
    const runningCount = flowRuns.filter(
      (r) => r.data.status === "running" || r.data.status === "waiting",
    ).length
    if (runningCount >= flow.backpressure.maxConcurrent) {
      throw new Error(
        `Flow ${flowId} has ${runningCount} concurrent runs (limit: ${flow.backpressure.maxConcurrent})`,
      )
    }
  }

  if (flow.backpressure.maxPending !== undefined) {
    const pendingCount = flowRuns.filter((r) => r.data.status === "waiting").length
    if (pendingCount >= flow.backpressure.maxPending) {
      throw new Error(
        `Flow ${flowId} has ${pendingCount} waiting runs (limit: ${flow.backpressure.maxPending})`,
      )
    }
  }
}

async function handleSubflow(
  data: EdemData,
  emit: EmitFn,
  flow: z.infer<typeof flowSchema>,
  run: z.infer<typeof runSchema>,
  runId: string,
  result: {
    context: {
      node_outputs: Record<string, Record<string, unknown>>
      trigger_data: Record<string, unknown>
      flow_variables: Record<string, unknown>
    }
    waitingNodeId?: string
  },
  waitingNode: { id: string; data?: Record<string, unknown> },
  parentItem: { data: Record<string, unknown> },
  lifecycle: NodeLifecycle,
): Promise<{ run_id: string; status: string } | null> {
  async function completeParentRunWithError(
    error: string,
  ): Promise<{ run_id: string; status: string }> {
    const completedAt = Date.now()
    const output = extractFlowOutput(flow, result.context)

    await data.updateItem({
      item_id: runId,
      data: {
        status: "error",
        output,
        error,
        waiting_node_id: null,
        completed_at: completedAt,
      },
    })

    const errorRun: z.infer<typeof runSchema> = {
      ...run,
      status: "error",
      output,
      error,
      waiting_node_id: null,
      completed_at: completedAt,
    }
    await emit.runCompleted(errorRun)

    return { run_id: runId, status: "error" }
  }

  const childFlowId = (waitingNode.data as Record<string, unknown>)?.flow_id as string
  if (!childFlowId) {
    return completeParentRunWithError("subflow node missing flow_id")
  }

  const childFlowItem = await data.getItem({ item_id: childFlowId })
  if (!childFlowItem.item) {
    return completeParentRunWithError(`Subflow flow ${childFlowId} not found`)
  }

  const childFlow = parseFlow(childFlowItem.item)
  if (childFlow.kind !== "subflow") {
    return completeParentRunWithError(`Subflow target ${childFlowId} must have kind "subflow"`)
  }

  const childValidation = getFlowValidationState(childFlow, procedureCatalogRef)
  if (!childValidation.valid) {
    return completeParentRunWithError(
      `Invalid subflow ${childFlowId}: ${childValidation.errors.join("; ")}`,
    )
  }

  const waitingOutput = result.context.node_outputs[result.waitingNodeId!] as
    | Record<string, unknown>
    | undefined
  const childInput: Record<string, unknown> =
    (waitingOutput?.input as Record<string, unknown>) ?? {}

  const parentDepth = (parentItem.data.depth as number) ?? 0
  if (parentDepth >= 10) {
    return completeParentRunWithError(`Subflow max depth (10) exceeded`)
  }

  const { id: childRunId } = await data.createItem({
    collection_id: RUNS_COLLECTION,
    data: {
      flow_id: childFlowId,
      status: "running",
      input: childInput,
      parent_run_id: runId,
      depth: parentDepth + 1,
      started_at: Date.now(),
    },
  })

  try {
    const childResult = await executeFlow(childFlow, childInput, undefined, {
      run_id: childRunId,
      lifecycle,
    })

    if (childResult.status === "waiting") {
      await data.updateItem({
        item_id: childRunId,
        data: {
          status: "waiting",
          context: childResult.context,
          waiting_node_id: childResult.waitingNodeId,
          timeout_at: calculateTimeoutAt(childFlow, childResult.waitingNodeId),
        },
      })
      await data.updateItem({
        item_id: runId,
        data: {
          status: "waiting",
          context: result.context,
          waiting_node_id: result.waitingNodeId,
          timeout_at: calculateTimeoutAt(flow, result.waitingNodeId),
        },
      })
      return { run_id: runId, status: "waiting" }
    }

    await data.updateItem({
      item_id: childRunId,
      data: {
        status: childResult.status,
        output: extractFlowOutput(childFlow, childResult.context),
        error: childResult.error ?? null,
        completed_at: Date.now(),
      },
    })

    if (childResult.status === "error") {
      return completeParentRunWithError(`Subflow failed: ${childResult.error}`)
    }

    const subflowOutput = extractFlowOutput(childFlow, childResult.context)

    result.context.node_outputs[result.waitingNodeId!] = {
      ...result.context.node_outputs[result.waitingNodeId!],
      child_output: subflowOutput,
      status: "completed",
    }

    const resumeResult = await executeFlow(flow, result.context.trigger_data, result.context, {
      run_id: runId,
      lifecycle,
    })

    if (resumeResult.status === "waiting") {
      await data.updateItem({
        item_id: runId,
        data: {
          status: "waiting",
          context: resumeResult.context,
          waiting_node_id: resumeResult.waitingNodeId,
        },
      })
      return { run_id: runId, status: "waiting" }
    }

    await data.updateItem({
      item_id: runId,
      data: {
        status: resumeResult.status,
        output: {
          ...extractFlowOutput(flow, resumeResult.context),
          subflow: subflowOutput,
        },
        completed_at: Date.now(),
      },
    })

    const completedRun: z.infer<typeof runSchema> = {
      ...run,
      status: resumeResult.status,
      output: {
        ...extractFlowOutput(flow, resumeResult.context),
        subflow: subflowOutput,
      },
      completed_at: Date.now(),
    }
    await emit.runCompleted(completedRun)
    return { run_id: runId, status: resumeResult.status }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    await data.updateItem({
      item_id: childRunId,
      data: {
        status: "error",
        error,
        completed_at: Date.now(),
      },
    })
    return completeParentRunWithError(`Subflow failed: ${error}`)
  }
}

async function ensureCollections(data: EdemData, retries = 3) {
  const collections = [
    {
      id: FLOWS_COLLECTION,
      name: "Flows",
      fields: [
        { name: "name", type: "string", required: true },
        { name: "status", type: "string" },
        { name: "kind", type: "string" },
        { name: "nodes", type: "json" },
        { name: "edges", type: "json" },
        { name: "valid", type: "boolean" },
        { name: "validation_errors", type: "json" },
        { name: "meta", type: "json" },
        { name: "manifest_id", type: "string" },
        { name: "backpressure", type: "json" },
      ],
    },
    {
      id: RUNS_COLLECTION,
      name: "Flow Runs",
      fields: [
        { name: "flow_id", type: "string", required: true },
        { name: "status", type: "string", required: true },
        { name: "input", type: "json" },
        { name: "output", type: "json" },
        { name: "context", type: "json" },
        { name: "waiting_node_id", type: "string" },
        { name: "timeout_at", type: "number" },
        { name: "error", type: "string" },
        { name: "parent_run_id", type: "string" },
        { name: "depth", type: "number" },
        { name: "started_at", type: "number" },
        { name: "completed_at", type: "number" },
      ],
    },
    {
      id: RUN_NODES_COLLECTION,
      name: "Flow Run Nodes",
      fields: [
        { name: "run_id", type: "string", required: true },
        { name: "node_id", type: "string", required: true },
        { name: "status", type: "string", required: true },
        { name: "input", type: "json" },
        { name: "output", type: "json" },
        { name: "error", type: "string" },
        { name: "attempts", type: "number" },
        { name: "started_at", type: "number" },
        { name: "completed_at", type: "number" },
      ],
    },
  ]

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      for (const def of collections) {
        try {
          const { collection } = await data.getCollection({ collection_id: def.id })
          if (!collection) {
            await data.createCollection({
              id: def.id,
              name: def.name,
              fields: def.fields as {
                name: string
                type: "string" | "json" | "number" | "boolean"
                required?: boolean
              }[],
            })
          }
        } catch (err) {
          if (!(err instanceof Error && err.message.includes("already exists"))) {
            throw err
          }
        }
      }
      return
    } catch (err) {
      if (attempt === retries - 1) {
        console.error("[edem-flows] Failed to ensure collections after retries:", err)
        return
      }
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt))
    }
  }
}

export default flowsModule

export { startScheduler } from "./scheduler"
export { startDispatcher } from "./dispatcher"
export type { SchedulerOptions } from "./scheduler"
export type { DispatcherOptions, FlowFilter } from "./dispatcher"
export { parseEvery, matchesSchedule, type ScheduleTrigger, type DayOfWeek } from "./manifest"
export { validateFlow } from "./engine"
export {
  executors,
  registerExecutor,
  type NodeExecutor,
  type NodeExecutorResult,
} from "./executors"
