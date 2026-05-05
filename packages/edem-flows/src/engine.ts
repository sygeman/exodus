import { createContext, setNodeOutput, type FlowContext } from "./context"
import { executors, type NodeExecutorResult } from "./executors"

export interface FlowNode {
  id: string
  type: string
  position: { x: number; y: number }
  data?: Record<string, unknown>
  retry_max?: number
  retry_delay?: number
  timeout?: number
}

export interface FlowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  condition?: string
  label?: string
}

export interface Flow {
  id: string
  name: string
  nodes: FlowNode[]
  edges: FlowEdge[]
}

export interface ExecutionResult {
  context: FlowContext
  nodeResults: Map<string, NodeExecutorResult>
  status: "completed" | "error" | "waiting"
  error?: string
  waitingNodeId?: string
}

export async function executeFlow(
  flow: Flow,
  triggerData: Record<string, unknown> = {},
): Promise<ExecutionResult> {
  const context = createContext(triggerData)
  const nodeResults = new Map<string, NodeExecutorResult>()
  const nodeMap = new Map(flow.nodes.map((n) => [n.id, n]))

  const adjacency = new Map<string, FlowEdge[]>()
  for (const edge of flow.edges) {
    if (!adjacency.has(edge.source)) {
      adjacency.set(edge.source, [])
    }
    adjacency.get(edge.source)!.push(edge)
  }

  const triggerNodes = flow.nodes.filter((n) => n.type === "trigger")

  if (triggerNodes.length === 0) {
    if (flow.nodes.length === 0) {
      return { context, nodeResults, status: "completed" }
    }
    triggerNodes.push(flow.nodes[0])
  }

  for (const triggerNode of triggerNodes) {
    const result = await executeNode(
      triggerNode.id,
      nodeMap,
      adjacency,
      context,
      nodeResults,
      new Set(),
      triggerData,
    )

    if (result.status === "waiting") {
      return {
        context,
        nodeResults,
        status: "waiting",
        waitingNodeId: result.waitingNodeId,
      }
    }

    if (result.status === "error") {
      return {
        context,
        nodeResults,
        status: "error",
        error: result.error,
      }
    }
  }

  return { context, nodeResults, status: "completed" }
}

async function executeNode(
  nodeId: string,
  nodeMap: Map<string, FlowNode>,
  adjacency: Map<string, FlowEdge[]>,
  context: FlowContext,
  nodeResults: Map<string, NodeExecutorResult>,
  visited: Set<string>,
  input: Record<string, unknown> = {},
  attempt: number = 1,
): Promise<{ status: "completed" | "waiting" | "error"; waitingNodeId?: string; error?: string }> {
  if (visited.has(nodeId) && attempt === 1) return { status: "completed" }
  if (attempt === 1) visited.add(nodeId)

  const node = nodeMap.get(nodeId)
  if (!node) return { status: "completed" }

  const executor = executors[node.type]
  if (!executor) {
    return { status: "error", error: `Unknown node type: ${node.type}` }
  }

  const result = await executor(node.data, input, context, nodeId)

  nodeResults.set(nodeId, result)
  setNodeOutput(context, nodeId, result.output)

  if (result.status === "async") {
    return { status: "waiting", waitingNodeId: nodeId }
  }

  const edges = adjacency.get(nodeId) ?? []
  const nextEdges = filterEdgesByResult(edges, result)

  for (const edge of nextEdges) {
    const nextResult = await executeNode(
      edge.target,
      nodeMap,
      adjacency,
      context,
      nodeResults,
      visited,
      result.output,
    )

    if (nextResult.status === "waiting") {
      return nextResult
    }

    if (nextResult.status === "error") {
      return nextResult
    }
  }

  return { status: "completed" }
}

function filterEdgesByResult(edges: FlowEdge[], result: NodeExecutorResult): FlowEdge[] {
  if (!result.followEdges || result.followEdges.length === 0) {
    return edges
  }

  const handles = new Set(result.followEdges.map((e) => e.handle))

  return edges.filter((edge) => {
    const handle = edge.sourceHandle ?? edge.label ?? "output"
    return handles.has(handle)
  })
}

export function validateFlowRunTransition(current: string, target: string): boolean {
  const validTransitions: Record<string, string[]> = {
    pending: ["running", "cancelled"],
    running: ["waiting", "completed", "error", "cancelled"],
    waiting: ["running", "completed", "error", "cancelled"],
    completed: [],
    error: [],
    cancelled: [],
  }

  return validTransitions[current]?.includes(target) ?? false
}
