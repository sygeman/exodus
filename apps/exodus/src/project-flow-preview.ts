import {
  FlowKind,
  NodeType,
  type FlowKind as FlowKindValue,
  type StoredFlowEdge,
  type StoredFlowNode,
} from "@/types/flow"

type PreviewContext = {
  trigger_data: Record<string, unknown>
  node_outputs: Record<string, Record<string, unknown>>
  flow_variables: Record<string, unknown>
}

export type ProjectFlowPreviewNodeState = {
  status: "completed" | "failed"
  output?: Record<string, unknown>
  error?: string
}

export type ProjectFlowPreviewResult = {
  status: "completed" | "failed"
  nodeStates: Record<string, ProjectFlowPreviewNodeState>
  finalOutput?: Record<string, unknown>
  error?: string
  stoppedNodeId?: string
  executedNodeIds: string[]
}

type PreviewNodeResult = {
  output: Record<string, unknown>
  followHandles?: string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function resolveNestedValue(value: unknown, path: string[]): unknown {
  let current = value

  for (const key of path) {
    if (current === null || current === undefined) return undefined
    if (typeof current !== "object") return undefined

    if (Array.isArray(current)) {
      const index = Number.parseInt(key, 10)
      if (Number.isNaN(index)) return undefined
      current = current[index]
    } else {
      current = (current as Record<string, unknown>)[key]
    }
  }

  return current
}

function resolveVariable(path: string, context: PreviewContext): unknown {
  const parts = path.split(".")
  if (parts.length === 0) return undefined

  const scope = parts[0]
  const rest = parts.slice(1)

  switch (scope) {
    case "trigger":
      return resolveNestedValue(context.trigger_data, rest)
    case "nodes": {
      if (rest.length === 0) return undefined
      const nodeId = rest[0]
      const nodeOutput = context.node_outputs[nodeId]
      if (!nodeOutput) return undefined

      if (rest.length >= 2 && rest[1] === "output") {
        return resolveNestedValue(nodeOutput, rest.slice(2))
      }

      return resolveNestedValue(nodeOutput, rest.slice(1))
    }
    case "context":
      return rest.length > 0 ? context.flow_variables[rest[0]] : undefined
    default:
      return undefined
  }
}

function resolveTemplate(template: string, context: PreviewContext): unknown {
  const regex = /\{\{([^}]+)\}\}/g
  const matches = [...template.matchAll(regex)]

  if (matches.length === 0) return template

  if (matches.length === 1 && matches[0]?.[0] === template.trim()) {
    return resolveVariable(matches[0][1].trim(), context)
  }

  return template.replace(regex, (_, path) => {
    const value = resolveVariable(path.trim(), context)
    if (value === undefined || value === null) return ""
    if (typeof value === "object") return JSON.stringify(value)
    return String(value)
  })
}

function resolveNodeInput(
  config: Record<string, unknown> | undefined,
  context: PreviewContext,
): Record<string, unknown> {
  if (!config) return {}

  const resolved: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(config)) {
    resolved[key] = typeof value === "string" ? resolveTemplate(value, context) : value
  }

  return resolved
}

function executeCondition(
  config: Record<string, unknown> | undefined,
  input: Record<string, unknown>,
  context: PreviewContext,
): PreviewNodeResult {
  const resolved = resolveNodeInput(config, context)
  const field = typeof resolved.field === "string" ? resolved.field : ""
  const value = resolved.value
  const operator = typeof resolved.operator === "string" ? resolved.operator : "eq"
  const inputValue = resolveNestedValue(input, field.split("."))

  let result = false

  switch (operator) {
    case "eq":
      result = inputValue === value
      break
    case "ne":
      result = inputValue !== value
      break
    case "gt":
      result =
        !Number.isNaN(Number(inputValue)) &&
        !Number.isNaN(Number(value)) &&
        Number(inputValue) > Number(value)
      break
    case "lt":
      result =
        !Number.isNaN(Number(inputValue)) &&
        !Number.isNaN(Number(value)) &&
        Number(inputValue) < Number(value)
      break
    case "gte":
      result =
        !Number.isNaN(Number(inputValue)) &&
        !Number.isNaN(Number(value)) &&
        Number(inputValue) >= Number(value)
      break
    case "lte":
      result =
        !Number.isNaN(Number(inputValue)) &&
        !Number.isNaN(Number(value)) &&
        Number(inputValue) <= Number(value)
      break
    case "contains":
      result = String(inputValue).includes(String(value))
      break
    default:
      result = inputValue === value
  }

  return {
    output: { result },
    followHandles: [result ? "true" : "false"],
  }
}

function executeTransform(
  config: Record<string, unknown> | undefined,
  input: Record<string, unknown>,
  context: PreviewContext,
): PreviewNodeResult {
  const resolved = resolveNodeInput(config, context)
  const field = typeof resolved.field === "string" ? resolved.field : ""
  const operation = typeof resolved.operation === "string" ? resolved.operation : "set"
  const value = resolved.value
  const inputValue = resolveNestedValue(input, field.split("."))

  if (!field && typeof resolved.code === "string" && resolved.code.trim() !== "") {
    throw new Error("Code-based transform preview is not supported")
  }

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

function executeSwitch(
  config: Record<string, unknown> | undefined,
  context: PreviewContext,
): PreviewNodeResult {
  const resolved = resolveNodeInput(config, context)
  const valueTemplate = resolved.value
  const cases = Array.isArray(resolved.cases)
    ? (resolved.cases as Array<{ value: string; handle: string }>)
    : []
  const defaultHandle =
    typeof resolved.default_handle === "string" ? resolved.default_handle : "default"

  const resolvedValue =
    typeof valueTemplate === "string" ? resolveTemplate(valueTemplate, context) : valueTemplate
  const valueStr = String(resolvedValue)
  const matchedCase = cases.find((entry) => entry.value === valueStr)
  const matchedHandle = matchedCase?.handle ?? defaultHandle

  return {
    output: { matched_handle: matchedHandle, value: valueStr },
    followHandles: [matchedHandle],
  }
}

function executeOutput(
  config: Record<string, unknown> | undefined,
  context: PreviewContext,
): PreviewNodeResult {
  const resolved = resolveNodeInput(config, context)
  const outputs = isRecord(resolved.outputs) ? resolved.outputs : {}
  const resolvedOutputs: Record<string, unknown> = {}

  for (const [key, path] of Object.entries(outputs)) {
    resolvedOutputs[key] = typeof path === "string" ? resolveTemplate(path, context) : path
  }

  return {
    output: { status: "completed", outputs: resolvedOutputs },
  }
}

function setNestedOutputValue(
  target: Record<string, unknown>,
  path: string[],
  value: unknown,
): void {
  if (path.length === 0) {
    return
  }

  let current: Record<string, unknown> = target

  for (let index = 0; index < path.length - 1; index += 1) {
    const key = path[index]
    const next = current[key]

    if (!isRecord(next)) {
      current[key] = {}
    }

    current = current[key] as Record<string, unknown>
  }

  current[path[path.length - 1]] = value
}

function executeMap(
  config: Record<string, unknown> | undefined,
  input: Record<string, unknown>,
): PreviewNodeResult {
  const mappings = Array.isArray(config?.mappings) ? config.mappings : []
  const output: Record<string, unknown> = {}

  for (const mapping of mappings) {
    if (!isRecord(mapping) || typeof mapping.targetPath !== "string") {
      continue
    }

    const targetPath = mapping.targetPath
      .split(".")
      .map((segment) => segment.trim())
      .filter((segment) => segment !== "")

    if (targetPath.length === 0) {
      continue
    }

    const resolvedValue =
      mapping.kind === "literal"
        ? mapping.literal
        : typeof mapping.sourcePath === "string"
          ? resolveNestedValue(input, mapping.sourcePath.split("."))
          : undefined

    setNestedOutputValue(output, targetPath, resolvedValue)
  }

  return { output }
}

function executeNodePreview(
  node: StoredFlowNode,
  input: Record<string, unknown>,
  context: PreviewContext,
): PreviewNodeResult {
  switch (node.type) {
    case NodeType.trigger:
      return { output: input }
    case NodeType.input:
      return {
        output:
          (context.trigger_data.inputs as Record<string, unknown>) ?? context.trigger_data ?? {},
      }
    case NodeType.map:
      return executeMap(node.data, input)
    case NodeType.condition:
      return executeCondition(node.data, input, context)
    case NodeType.transform:
      return executeTransform(node.data, input, context)
    case NodeType.switch:
      return executeSwitch(node.data, context)
    case NodeType.output:
      return executeOutput(node.data, context)
    case NodeType.delay:
      throw new Error("Delay nodes are not executed in design-time preview")
    case NodeType.call:
      throw new Error("Procedure calls are not executed in design-time preview")
    case NodeType.subflow:
      throw new Error("Subflow nodes are not executed in design-time preview")
    case NodeType.loop:
      throw new Error("Loop nodes are not executed in design-time preview")
    case NodeType.fork:
      throw new Error("Fork nodes are not executed in design-time preview")
    case NodeType.join:
      throw new Error("Join nodes are not executed in design-time preview")
    default:
      throw new Error(`Unsupported node type: ${node.type}`)
  }
}

function filterEdgesByResult(edges: StoredFlowEdge[], result: PreviewNodeResult): StoredFlowEdge[] {
  if (!result.followHandles || result.followHandles.length === 0) {
    return edges
  }

  const handles = new Set(result.followHandles)

  return edges.filter((edge) => {
    const handle = edge.sourceHandle ?? edge.label ?? "output"
    return handles.has(handle)
  })
}

export function runProjectFlowPreview(input: {
  kind: FlowKindValue
  nodes: StoredFlowNode[]
  edges: StoredFlowEdge[]
  triggerData?: Record<string, unknown>
}): ProjectFlowPreviewResult {
  const context: PreviewContext = {
    trigger_data: input.triggerData ?? {},
    node_outputs: {},
    flow_variables: {},
  }

  const nodeStates: Record<string, ProjectFlowPreviewNodeState> = {}
  const executedNodeIds: string[] = []
  const nodeMap = new Map(input.nodes.map((node) => [node.id, node]))
  const adjacency = new Map<string, StoredFlowEdge[]>()

  for (const edge of input.edges) {
    const existing = adjacency.get(edge.source) ?? []
    existing.push(edge)
    adjacency.set(edge.source, existing)
  }

  const entryNodeType = input.kind === FlowKind.subflow ? NodeType.input : NodeType.trigger
  const entryNodes = input.nodes.filter((node) => node.type === entryNodeType)

  if (entryNodes.length === 0) {
    return {
      status: "failed",
      nodeStates,
      executedNodeIds,
      error: `Flow has no ${entryNodeType} node for preview`,
    }
  }

  let finalOutput: Record<string, unknown> | undefined

  const visitNode = (
    nodeId: string,
    nodeInput: Record<string, unknown>,
    visited: Set<string>,
  ):
    | { ok: true; output: Record<string, unknown> }
    | { ok: false; error: string; nodeId: string } => {
    if (visited.has(nodeId)) {
      return { ok: true, output: context.node_outputs[nodeId] ?? {} }
    }

    const node = nodeMap.get(nodeId)
    if (!node) {
      return { ok: false, error: `Preview node "${nodeId}" not found`, nodeId }
    }

    try {
      const result = executeNodePreview(node, nodeInput, context)
      context.node_outputs[nodeId] = result.output
      nodeStates[nodeId] = { status: "completed", output: result.output }
      executedNodeIds.push(nodeId)
      finalOutput = result.output

      const nextVisited = new Set(visited)
      nextVisited.add(nodeId)
      const nextEdges = filterEdgesByResult(adjacency.get(nodeId) ?? [], result)

      for (const edge of nextEdges) {
        const nextResult = visitNode(edge.target, result.output, nextVisited)
        if (!nextResult.ok) {
          return nextResult
        }
      }

      return { ok: true, output: result.output }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      nodeStates[nodeId] = { status: "failed", error: message }
      executedNodeIds.push(nodeId)
      return { ok: false, error: message, nodeId }
    }
  }

  for (const entryNode of entryNodes) {
    const result = visitNode(entryNode.id, input.triggerData ?? {}, new Set())
    if (!result.ok) {
      return {
        status: "failed",
        nodeStates,
        executedNodeIds,
        finalOutput,
        error: result.error,
        stoppedNodeId: result.nodeId,
      }
    }
  }

  return {
    status: "completed",
    nodeStates,
    executedNodeIds,
    finalOutput,
  }
}
