import uiFlowsManifest from "../../../edem-manifests/ui-flows.json"
import type { LogicFlowDefinition, LogicFlowEdge, LogicFlowNode } from "../contracts"

type RuntimeFlowMeta = {
  profile?: LogicFlowDefinition["profile"]
  runtime?: LogicFlowDefinition["runtime"]
  screen?: string
  uiTrigger?: LogicFlowDefinition["trigger"]
}

type RuntimeFlowManifest = {
  id: string
  nodes: LogicFlowNode[]
  edges?: LogicFlowEdge[]
  meta?: RuntimeFlowMeta
}

type RuntimeFlowsManifest = {
  flows: RuntimeFlowManifest[]
}

export function getRuntimeFlowsForScreen(screenId: string): Record<string, LogicFlowDefinition> {
  const manifest = uiFlowsManifest as RuntimeFlowsManifest

  return Object.fromEntries(
    manifest.flows
      .filter((flow) => flow.meta?.screen === screenId)
      .map((flow) => [
        flow.id,
        {
          id: flow.id,
          profile: flow.meta?.profile ?? "ui-action",
          runtime: flow.meta?.runtime ?? "client",
          trigger: flow.meta?.uiTrigger,
          nodes: flow.nodes,
          edges: flow.edges,
        } satisfies LogicFlowDefinition,
      ]),
  )
}
