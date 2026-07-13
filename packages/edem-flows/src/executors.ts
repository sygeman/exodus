import {
  resolveNodeInput,
  resolveTemplate,
  resolveNestedValue,
  setFlowVariable,
  type FlowContext,
} from "./context"
import { buildMapNodeOutput } from "./map-node"

let edemModules: Record<string, Record<string, unknown>> | null = null

export function setEdemModules(modules: Record<string, Record<string, unknown>>): void {
  edemModules = modules
}

export interface NodeExecutorResult {
  output: Record<string, unknown>
  followEdges?: Array<{ handle: string }>
  status?: "completed" | "async"
}

export type NodeExecutor = (
  config: Record<string, unknown> | undefined,
  input: Record<string, unknown>,
  context: FlowContext,
  nodeId?: string,
) => Promise<NodeExecutorResult>

export interface ProcedureReference {
  module: string
  procedure: string
}

export const executors: Record<string, NodeExecutor> = {
  trigger: executeTrigger,
  map: executeMap,
  condition: executeCondition,
  transform: executeTransform,
  switch: executeSwitch,
  delay: executeDelay,
  input: executeInput,
  output: executeOutput,
  loop: executeLoop,
  fork: executeFork,
  join: executeJoin,
  subflow: executeSubflow,
}

export function registerExecutor(name: string, executor: NodeExecutor): void {
  executors[name] = executor
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

export function getProcedureReference(
  nodeType: string,
  config?: Record<string, unknown>,
): ProcedureReference | null {
  if (nodeType !== "call") {
    return null
  }

  const moduleName = config?.module
  const procedureName = config?.procedure

  return typeof moduleName === "string" && typeof procedureName === "string"
    ? { module: moduleName, procedure: procedureName }
    : null
}

async function executeProcedureReference(
  reference: ProcedureReference,
  input: Record<string, unknown>,
): Promise<NodeExecutorResult> {
  const moduleProxy = edemModules?.[reference.module] as
    | Record<string, (procInput: unknown) => Promise<unknown>>
    | undefined
  const proc = moduleProxy?.[reference.procedure]

  if (!proc) {
    throw new Error(`Procedure "${reference.module}.${reference.procedure}" not found`)
  }

  const result = await proc(input)
  if (!isRecord(result)) {
    throw new Error(
      `Procedure "${reference.module}.${reference.procedure}" must return an object to be used as a flow node`,
    )
  }

  if (result.status === "pending") {
    return { output: result, status: "async" }
  }

  return { output: result }
}

export function resolveNodeExecutor(
  nodeType: string,
  config?: Record<string, unknown>,
): NodeExecutor | null {
  const builtinExecutor = executors[nodeType]
  if (builtinExecutor) {
    return builtinExecutor
  }

  const reference = getProcedureReference(nodeType, config)
  if (!reference) {
    return null
  }

  return async (_config, input) => executeProcedureReference(reference, input)
}

async function executeTrigger(
  _config: Record<string, unknown> | undefined,
  input: Record<string, unknown>,
  _context: FlowContext,
): Promise<NodeExecutorResult> {
  return { output: input }
}

async function executeMap(
  config: Record<string, unknown> | undefined,
  input: Record<string, unknown>,
): Promise<NodeExecutorResult> {
  return {
    output: buildMapNodeOutput(config?.mappings, input),
  }
}

async function executeCondition(
  config: Record<string, unknown> | undefined,
  input: Record<string, unknown>,
  context: FlowContext,
): Promise<NodeExecutorResult> {
  const resolved = resolveNodeInput(config, context)
  const field = resolved.field as string
  const value = resolved.value
  const operator = (resolved.operator as string) ?? "eq"

  const inputValue = resolveNestedValue(input, field.split("."))

  let result = false

  switch (operator) {
    case "eq":
      result = inputValue === value
      break
    case "ne":
      result = inputValue !== value
      break
    case "gt": {
      const a = Number(inputValue)
      const b = Number(value)
      result = !isNaN(a) && !isNaN(b) && a > b
      break
    }
    case "lt": {
      const a = Number(inputValue)
      const b = Number(value)
      result = !isNaN(a) && !isNaN(b) && a < b
      break
    }
    case "gte": {
      const a = Number(inputValue)
      const b = Number(value)
      result = !isNaN(a) && !isNaN(b) && a >= b
      break
    }
    case "lte": {
      const a = Number(inputValue)
      const b = Number(value)
      result = !isNaN(a) && !isNaN(b) && a <= b
      break
    }
    case "contains":
      result = String(inputValue).includes(String(value))
      break
    default:
      result = inputValue === value
  }

  return {
    output: { result },
    followEdges: [{ handle: result ? "true" : "false" }],
  }
}

async function executeTransform(
  config: Record<string, unknown> | undefined,
  input: Record<string, unknown>,
  context: FlowContext,
): Promise<NodeExecutorResult> {
  const resolved = resolveNodeInput(config, context)
  const field = resolved.field as string
  const operation = (resolved.operation as string) ?? "set"
  const value = resolved.value

  const inputValue = resolveNestedValue(input, field.split("."))

  let result: unknown

  switch (operation) {
    case "set":
      result = value
      break
    case "add":
      result = Number(inputValue) + Number(value)
      break
    case "multiply":
      result = Number(inputValue) * Number(value)
      break
    case "append":
      result = String(inputValue) + String(value)
      break
    default:
      result = value
  }

  return { output: { result } }
}

async function executeSwitch(
  config: Record<string, unknown> | undefined,
  _input: Record<string, unknown>,
  context: FlowContext,
): Promise<NodeExecutorResult> {
  const resolved = resolveNodeInput(config, context)
  const valueTemplate = resolved.value as string
  const cases = (resolved.cases as Array<{ value: string; handle: string }>) ?? []
  const defaultHandle = (resolved.default_handle as string) ?? "default"

  const resolvedValue =
    typeof valueTemplate === "string" ? resolveTemplate(valueTemplate, context) : valueTemplate

  const valueStr = String(resolvedValue)

  const matchedCase = cases.find((c) => c.value === valueStr)
  const matchedHandle = matchedCase?.handle ?? defaultHandle

  return {
    output: { matched_handle: matchedHandle, value: valueStr },
    followEdges: [{ handle: matchedHandle }],
  }
}

async function executeDelay(
  config: Record<string, unknown> | undefined,
  _input: Record<string, unknown>,
  context: FlowContext,
  nodeId?: string,
): Promise<NodeExecutorResult> {
  if (nodeId && context.node_outputs[nodeId]?.status === "completed") {
    return {
      output: context.node_outputs[nodeId],
      status: "completed",
    }
  }

  const resolved = resolveNodeInput(config, context)
  const seconds = Math.max(1, Number(resolved.seconds ?? 1))
  const resumeAt = Date.now() + seconds * 1000

  if (nodeId) {
    setFlowVariable(context, `nodes.${nodeId}.resumeAt`, resumeAt)
  }

  return {
    output: { status: "pending", delayed_seconds: seconds, resume_at: resumeAt },
    status: "async",
  }
}

async function executeInput(
  _config: Record<string, unknown> | undefined,
  _input: Record<string, unknown>,
  context: FlowContext,
): Promise<NodeExecutorResult> {
  const inputs =
    (context.trigger_data.inputs as Record<string, unknown>) ?? context.trigger_data ?? {}
  return { output: inputs }
}

async function executeOutput(
  config: Record<string, unknown> | undefined,
  _input: Record<string, unknown>,
  context: FlowContext,
): Promise<NodeExecutorResult> {
  const resolved = resolveNodeInput(config, context)
  const outputs = (resolved.outputs as Record<string, string>) ?? {}

  const resolvedOutputs: Record<string, unknown> = {}

  for (const [key, path] of Object.entries(outputs)) {
    if (typeof path === "string") {
      resolvedOutputs[key] = resolveTemplate(path, context)
    } else {
      resolvedOutputs[key] = path
    }
  }

  return {
    output: { status: "completed", outputs: resolvedOutputs },
  }
}

async function executeLoop(
  config: Record<string, unknown> | undefined,
  input: Record<string, unknown>,
  context: FlowContext,
  nodeId?: string,
): Promise<NodeExecutorResult> {
  const resolved = resolveNodeInput(config, context)
  const maxIterations = Number(resolved.maxIterations ?? 1)
  const moduleName = resolved.module as string | undefined
  const procedureName = resolved.procedure as string | undefined
  const autoIterate = resolved.autoIterate === true

  const iterationKey = nodeId ? `nodes.${nodeId}.currentIteration` : "loop.currentIteration"
  const resultsKey = nodeId ? `nodes.${nodeId}.results` : "loop.results"
  const currentIteration = (context.flow_variables[iterationKey] as number) ?? 0

  if (autoIterate && procedureName) {
    let handler:
      | ((input: Record<string, unknown>, context: FlowContext) => Promise<Record<string, unknown>>)
      | undefined

    if (moduleName && edemModules?.[moduleName]) {
      const moduleProxy = edemModules[moduleName] as Record<
        string,
        (input: unknown) => Promise<unknown>
      >
      const proc = moduleProxy[procedureName]
      if (proc) {
        handler = async (iterInput: Record<string, unknown>, _context: FlowContext) => {
          const result = await proc(iterInput)
          return result as Record<string, unknown>
        }
      }
    }

    if (handler) {
      const results = (context.flow_variables[resultsKey] as unknown[]) ?? []

      for (let i = currentIteration; i < maxIterations; i++) {
        if (i > currentIteration && i % 10 === 0) {
          await new Promise((r) => setTimeout(r, 0))
        }
        setFlowVariable(context, iterationKey, i + 1)
        const iterResult = await handler({ iteration: i + 1, input }, context)
        results.push(iterResult)
      }

      setFlowVariable(context, resultsKey, results)

      return {
        output: {
          status: "completed",
          iterations: maxIterations,
          results,
          final: true,
        },
      }
    }
  }

  const nextIteration = currentIteration + 1
  setFlowVariable(context, iterationKey, nextIteration)

  if (nextIteration >= maxIterations) {
    return {
      output: {
        status: "completed",
        iteration: nextIteration,
        final: true,
      },
    }
  }

  return {
    output: {
      status: "pending",
      iteration: nextIteration,
      procedure: procedureName,
      input,
    },
    status: "async",
  }
}

async function executeFork(
  config: Record<string, unknown> | undefined,
  input: Record<string, unknown>,
  context: FlowContext,
  nodeId?: string,
): Promise<NodeExecutorResult> {
  const resolved = resolveNodeInput(config, context)
  const branches = (resolved.branches as Array<{ id: string }>) ?? []

  if (nodeId) {
    setFlowVariable(context, `nodes.${nodeId}.forkBranches`, branches)
  }

  const followEdges = branches.map((branch) => ({ handle: branch.id }))

  return {
    output: {
      status: "forked",
      branches: branches.map((b) => b.id),
      input,
    },
    followEdges,
  }
}

async function executeJoin(
  config: Record<string, unknown> | undefined,
  input: Record<string, unknown>,
  context: FlowContext,
  nodeId?: string,
): Promise<NodeExecutorResult> {
  const resolved = resolveNodeInput(config, context)
  const mode = (resolved.mode as string) ?? "all"

  if (nodeId) {
    setFlowVariable(context, `nodes.${nodeId}.joinMode`, mode)
  }

  const branchOutputs: Record<string, unknown>[] = []

  if (input && typeof input === "object") {
    for (const [key, value] of Object.entries(input)) {
      if (key !== "status" && key !== "mode") {
        if (typeof value === "object" && value !== null) {
          branchOutputs.push(value as Record<string, unknown>)
        } else {
          branchOutputs.push({ value })
        }
      }
    }
  }

  let aggregated: unknown
  switch (mode) {
    case "any":
      aggregated = branchOutputs.length > 0 ? branchOutputs[0] : undefined
      break
    case "n_of_m": {
      const n = Number((resolved as Record<string, unknown>).n ?? branchOutputs.length)
      aggregated = branchOutputs.slice(0, n)
      break
    }
    case "all":
    default:
      aggregated = branchOutputs
      break
  }

  return {
    output: {
      status: "completed",
      mode,
      branches: branchOutputs.length,
      aggregated,
    },
  }
}

async function executeSubflow(
  config: Record<string, unknown> | undefined,
  input: Record<string, unknown>,
  context: FlowContext,
  nodeId?: string,
): Promise<NodeExecutorResult> {
  if (nodeId && context.node_outputs[nodeId]?.status === "completed") {
    return {
      output: (context.node_outputs[nodeId].child_output as Record<string, unknown>) ?? {},
      status: "completed",
    }
  }

  const resolved = resolveNodeInput(config, context)
  const flowId = resolved.flow_id as string

  if (!flowId) {
    return {
      output: { status: "error", error: "flow_id is required" },
    }
  }

  return {
    output: {
      status: "pending",
      flow_id: flowId,
      input,
    },
    status: "async",
  }
}
