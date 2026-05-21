import type { FlowManifest, FlowsManifest } from "@exodus/edem-flows"
import type { ProcedureCatalogModule } from "@/procedure-catalog"
import { normalizeProjectFlowGraph } from "@/project-flow-normalization"
import { getFlowKind, type StoredFlowEdge, type StoredFlowNode } from "@/types/flow"

export type ProjectFlowSourceItem = {
  id: string
  data: {
    name?: unknown
    kind?: unknown
    nodes?: unknown
    edges?: unknown
    meta?: unknown
    manifest_id?: unknown
    backpressure?: unknown
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function toProjectFlowManifest(
  flow: ProjectFlowSourceItem,
  procedureCatalog?: ProcedureCatalogModule[],
): FlowManifest {
  const kind = getFlowKind(flow.data.kind)
  const nodes = (Array.isArray(flow.data.nodes) ? flow.data.nodes : []) as StoredFlowNode[]
  const normalized = normalizeProjectFlowGraph({
    kind,
    nodes,
    edges: (Array.isArray(flow.data.edges) ? flow.data.edges : []) as StoredFlowEdge[],
    procedureCatalog,
  })
  const manifestId =
    typeof flow.data.manifest_id === "string" && flow.data.manifest_id.length > 0
      ? flow.data.manifest_id
      : flow.id

  return {
    id: manifestId,
    name: typeof flow.data.name === "string" ? flow.data.name : "",
    kind,
    nodes: normalized.nodes,
    edges: normalized.edges,
    meta: isRecord(flow.data.meta) ? flow.data.meta : undefined,
    backpressure: isRecord(flow.data.backpressure)
      ? {
          maxPending:
            typeof flow.data.backpressure.maxPending === "number"
              ? flow.data.backpressure.maxPending
              : undefined,
          maxConcurrent:
            typeof flow.data.backpressure.maxConcurrent === "number"
              ? flow.data.backpressure.maxConcurrent
              : undefined,
        }
      : undefined,
  }
}

export function buildProjectFlowsManifest(
  flows: ProjectFlowSourceItem[],
  procedureCatalog?: ProcedureCatalogModule[],
): FlowsManifest {
  return {
    flows: flows.map((flow) => toProjectFlowManifest(flow, procedureCatalog)),
  }
}
