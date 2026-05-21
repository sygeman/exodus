import type { Trigger, FlowManifest, FlowNodeRecord, FlowEdgeRecord } from "./manifest"

const DEFAULT_TRIGGER: Trigger = { type: "manual" }

type FlowShapeInput = {
  kind?: "flow" | "subflow"
  trigger?: Trigger
  nodes?: FlowNodeRecord[]
  edges?: FlowEdgeRecord[]
}

export function triggerNode(
  trigger: Trigger = DEFAULT_TRIGGER,
  input?: Partial<Pick<FlowNodeRecord, "id" | "position" | "data">>,
): FlowNodeRecord {
  return {
    id: input?.id ?? "trigger",
    type: "trigger",
    position: input?.position ?? { x: 0, y: 0 },
    data: {
      ...input?.data,
      source: trigger,
    },
  }
}

export function canonicalFlowShape(input: FlowShapeInput): {
  nodes: FlowNodeRecord[]
  edges: FlowEdgeRecord[]
} {
  if (input.kind === "subflow") {
    return {
      nodes: input.nodes ?? [],
      edges: input.edges ?? [],
    }
  }

  const trigger = input.trigger ?? DEFAULT_TRIGGER
  const nodes = input.nodes ?? [triggerNode(trigger)]
  const hasTriggerNode = nodes.some((node) => node.type === "trigger")

  return {
    nodes: hasTriggerNode
      ? nodes.map((node) =>
          node.type === "trigger"
            ? {
                ...node,
                data: {
                  ...node.data,
                  source: trigger,
                },
              }
            : node,
        )
      : [triggerNode(trigger), ...nodes],
    edges: input.edges ?? [],
  }
}

export function canonicalManifestFlow(
  input: Omit<FlowManifest, "nodes" | "edges"> & FlowShapeInput,
): FlowManifest {
  const { nodes, edges } = canonicalFlowShape(input)

  return {
    id: input.id,
    name: input.name,
    kind: input.kind,
    nodes,
    edges,
    meta: input.meta,
    backpressure: input.backpressure,
  }
}

export function callNode(input: {
  id: string
  module: string
  procedure: string
  position?: { x: number; y: number }
  data?: Record<string, unknown>
}): FlowNodeRecord {
  return {
    id: input.id,
    type: "call",
    position: input.position ?? { x: 100, y: 0 },
    data: {
      ...input.data,
      module: input.module,
      procedure: input.procedure,
    },
  }
}
