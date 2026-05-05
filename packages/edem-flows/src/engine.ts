import { createContext, setNodeOutput, type FlowContext } from "./context"
import { executors, type NodeExecutorResult } from "./executors"

export interface FlowNode {
  id: string
  type: string
  position: { x: number; y: number }
  data?: Record<string, unknown>
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
  status: "completed" | "error"
  error?: string
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
    try {
      await executeNode(
        triggerNode.id,
        nodeMap,
        adjacency,
        context,
        nodeResults,
        new Set(),
        triggerData,
      )
    } catch (err) {
      return {
        context,
        nodeResults,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
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
): Promise<void> {
  if (visited.has(nodeId)) return
  visited.add(nodeId)

  const node = nodeMap.get(nodeId)
  if (!node) return

  const executor = executors[node.type]
  if (!executor) {
    throw new Error(`Unknown node type: ${node.type}`)
  }

  const result = await executor(node.data, input, context)

  nodeResults.set(nodeId, result)
  setNodeOutput(context, nodeId, result.output)

  const edges = adjacency.get(nodeId) ?? []
  const nextEdges = filterEdgesByResult(edges, result)

  for (const edge of nextEdges) {
    await executeNode(edge.target, nodeMap, adjacency, context, nodeResults, visited, result.output)
  }
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
