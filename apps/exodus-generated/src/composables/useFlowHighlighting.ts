import { computed, type Ref } from "vue"
import type { Styles } from "@vue-flow/core"

type FlowNode = {
  id: string
  [key: string]: unknown
}

type FlowEdge = {
  id: string
  source: string
  target: string
  sourceHandle?: string
  [key: string]: unknown
}

type EdgeTopology = {
  source: string
  target: string
  sourceHandle?: string
}

type PathResult = {
  nodeIds: Set<string>
  nodeHandles: Map<string, Set<string>>
}

function getPathToNode(targetNodeId: string, nodes: FlowNode[], edges: EdgeTopology[]): PathResult {
  const nodeIds = new Set<string>()
  const nodeHandles = new Map<string, Set<string>>()

  const incomingEdges = new Map<string, EdgeTopology[]>()
  for (const node of nodes) {
    incomingEdges.set(node.id, [])
  }
  for (const edge of edges) {
    incomingEdges.get(edge.target)?.push(edge)
  }

  const queue = [targetNodeId]
  const visited = new Set<string>()

  while (queue.length > 0) {
    const nodeId = queue.shift()!
    if (visited.has(nodeId)) continue
    visited.add(nodeId)
    nodeIds.add(nodeId)

    const nodeEdges = incomingEdges.get(nodeId) || []
    for (const edge of nodeEdges) {
      if (!visited.has(edge.source)) {
        queue.push(edge.source)
      }
      if (edge.sourceHandle) {
        if (!nodeHandles.has(edge.source)) {
          nodeHandles.set(edge.source, new Set())
        }
        nodeHandles.get(edge.source)!.add(edge.sourceHandle)
      }
    }
  }

  return { nodeIds, nodeHandles }
}

const EDGE_COLORS: Record<string, string> = {
  success: "var(--color-success-500)",
  error: "var(--color-error-500)",
  true: "var(--color-success-500)",
  false: "var(--color-error-500)",
  body: "var(--color-secondary-500)",
  exit: "var(--color-success-500)",
  default: "var(--color-neutral-500)",
}

function getEdgeColor(sourceHandle: string | null | undefined): string {
  if (!sourceHandle) return "var(--color-neutral-500)"
  if (sourceHandle.startsWith("case")) return "var(--color-info-500)"
  return EDGE_COLORS[sourceHandle] || "var(--color-neutral-500)"
}

export function useFlowHighlighting(
  vfNodes: Ref<FlowNode[]>,
  vfEdges: Ref<FlowEdge[]>,
  selectedNodeId: Ref<string | null>,
) {
  const edgeTopology = computed<EdgeTopology[]>(() =>
    vfEdges.value.map((e) => ({
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
    })),
  )

  const highlightedPath = computed<PathResult>(() => {
    if (!selectedNodeId.value) {
      return { nodeIds: new Set(), nodeHandles: new Map() }
    }
    return getPathToNode(selectedNodeId.value, vfNodes.value, edgeTopology.value)
  })

  const highlightedNodeIds = computed(() => highlightedPath.value.nodeIds)

  function applyEdgeHighlighting() {
    const highlighted = highlightedNodeIds.value

    vfEdges.value = vfEdges.value.map((edge) => {
      const isHighlighted = highlighted.has(edge.source) && highlighted.has(edge.target)

      if (isHighlighted) {
        const handle = edge.sourceHandle
        const color =
          !handle || handle === "default" ? "var(--color-neutral-300)" : getEdgeColor(handle)
        return {
          ...edge,
          type: "deleteable",
          style: { stroke: color } as Styles,
          animated: true,
        }
      }
      return {
        ...edge,
        type: "deleteable",
        style: { stroke: "var(--color-neutral-500)" } as Styles,
        animated: false,
      }
    })
  }

  return {
    highlightedNodeIds,
    applyEdgeHighlighting,
  }
}
