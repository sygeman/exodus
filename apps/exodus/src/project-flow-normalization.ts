import type { ProcedureCatalogModule } from "@/procedure-catalog"
import {
  DEFAULT_FLOW_TRIGGER,
  FlowKind,
  NodeType,
  deriveTriggerFromNodes,
  getTriggerNodeData,
  type FlowKind as FlowKindValue,
  type FlowTrigger,
  type StoredFlowEdge,
  type StoredFlowNode,
} from "@/types/flow"

type ProcedureReference = {
  module: string
  procedure: string
}

function getProcedureReference(node: StoredFlowNode): ProcedureReference | null {
  if (node.type !== NodeType.call) {
    return null
  }

  const moduleName = typeof node.data.module === "string" ? node.data.module : null
  const procedureName = typeof node.data.procedure === "string" ? node.data.procedure : null

  return moduleName && procedureName ? { module: moduleName, procedure: procedureName } : null
}

function normalizeProcedureBackedNode(node: StoredFlowNode): StoredFlowNode {
  const reference = getProcedureReference(node)

  if (!reference) {
    return node
  }

  return {
    ...node,
    data: {
      ...node.data,
      module: reference.module,
      procedure: reference.procedure,
    },
  }
}

function syncTriggerNodes(
  nodes: StoredFlowNode[],
  edges: StoredFlowEdge[],
  trigger: FlowTrigger,
): { nodes: StoredFlowNode[]; edges: StoredFlowEdge[] } {
  const triggerNodes = nodes.filter((node) => node.type === NodeType.trigger)

  if (triggerNodes.length > 0) {
    return {
      nodes: nodes.map((node) =>
        node.type === NodeType.trigger
          ? {
              ...node,
              data: {
                ...node.data,
                ...getTriggerNodeData(trigger),
                label: typeof node.data.label === "string" ? node.data.label : "Trigger",
              },
            }
          : node,
      ),
      edges,
    }
  }

  const triggerId = nodes.some((node) => node.id === "trigger") ? "trigger_entry" : "trigger"
  const targetNodeIds = new Set(edges.map((edge) => edge.target))
  const rootNodes = nodes.filter((node) => !targetNodeIds.has(node.id))
  const triggerNode: StoredFlowNode = {
    id: triggerId,
    type: NodeType.trigger,
    position: { x: 0, y: 0 },
    data: {
      label: "Trigger",
      ...getTriggerNodeData(trigger),
    },
  }

  const triggerEdges = rootNodes.map((node) => ({
    id: `${triggerId}-${node.id}`,
    source: triggerId,
    target: node.id,
  }))

  return {
    nodes: [triggerNode, ...nodes],
    edges: [...triggerEdges, ...edges],
  }
}

export function normalizeProjectFlowGraph(input: {
  kind: FlowKindValue
  nodes: StoredFlowNode[]
  edges: StoredFlowEdge[]
  procedureCatalog?: ProcedureCatalogModule[]
}): { nodes: StoredFlowNode[]; edges: StoredFlowEdge[]; trigger: FlowTrigger | null } {
  const normalizedProcedureNodes = input.nodes.map((node) => normalizeProcedureBackedNode(node))

  if (input.kind === FlowKind.subflow) {
    return {
      nodes: normalizedProcedureNodes,
      edges: input.edges,
      trigger: null,
    }
  }

  const trigger = deriveTriggerFromNodes(input.kind, normalizedProcedureNodes)

  const synced = syncTriggerNodes(
    normalizedProcedureNodes,
    input.edges,
    trigger ?? DEFAULT_FLOW_TRIGGER,
  )

  return {
    nodes: synced.nodes,
    edges: synced.edges,
    trigger,
  }
}
