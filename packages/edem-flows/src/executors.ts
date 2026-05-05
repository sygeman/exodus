import { resolveNodeInput, resolveTemplate, setFlowVariable, type FlowContext } from "./context"

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

export const executors: Record<string, NodeExecutor> = {
  trigger: executeTrigger,
  condition: executeCondition,
  transform: executeTransform,
  switch: executeSwitch,
  delay: executeDelay,
  input: executeInput,
  output: executeOutput,
  action: executeAction,
  loop: executeLoop,
}

async function executeTrigger(
  _config: Record<string, unknown> | undefined,
  input: Record<string, unknown>,
  _context: FlowContext,
): Promise<NodeExecutorResult> {
  return { output: input }
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

  const inputValue = field.startsWith("{{")
    ? resolveTemplate(field, context)
    : resolveNestedValue(input, field.split("."))

  let result = false

  switch (operator) {
    case "eq":
      result = inputValue === value
      break
    case "ne":
      result = inputValue !== value
      break
    case "gt":
      result = Number(inputValue) > Number(value)
      break
    case "lt":
      result = Number(inputValue) < Number(value)
      break
    case "gte":
      result = Number(inputValue) >= Number(value)
      break
    case "lte":
      result = Number(inputValue) <= Number(value)
      break
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
): Promise<NodeExecutorResult> {
  const resolved = resolveNodeInput(config, context)
  const seconds = Math.max(1, Number(resolved.seconds ?? 1))

  await new Promise((resolve) => setTimeout(resolve, seconds * 1000))

  return {
    output: { status: "completed", delayed_seconds: seconds },
  }
}

async function executeInput(
  _config: Record<string, unknown> | undefined,
  _input: Record<string, unknown>,
  context: FlowContext,
): Promise<NodeExecutorResult> {
  const inputs = (context.trigger_data.inputs as Record<string, unknown>) ?? {}
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

function resolveNestedValue(value: unknown, path: string[]): unknown {
  let current = value

  for (const key of path) {
    if (current === null || current === undefined) return undefined
    if (typeof current !== "object") return undefined

    if (Array.isArray(current)) {
      const index = parseInt(key, 10)
      if (isNaN(index)) return undefined
      current = current[index]
    } else {
      current = (current as Record<string, unknown>)[key]
    }
  }

  return current
}

async function executeAction(
  config: Record<string, unknown> | undefined,
  input: Record<string, unknown>,
  context: FlowContext,
): Promise<NodeExecutorResult> {
  const resolved = resolveNodeInput(config, context)
  const actionType = (resolved.action as string) ?? (resolved.type as string)

  return {
    output: {
      status: "pending",
      action: actionType,
      input,
    },
    status: "async",
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

  const iterationKey = nodeId ? `nodes.${nodeId}.currentIteration` : "loop.currentIteration"
  const currentIteration = (context.flow_variables[iterationKey] as number) ?? 0

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
      action: resolved.action as string,
      input,
    },
    status: "async",
  }
}
