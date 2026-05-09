import type { ComponentNode } from "@exodus/edem-ui"

// ── Intermediate Representation (IR) ──────────────────────────────────────────
// Framework-agnostic description of the application.
// Generated from manifests (data.json + flows.json + ui.json).

export interface IR {
  project: IRProject
  components: IRComponent[]
  routes: IRRoute[]
  collections: IRCollection[]
  flows: IRFlow[]
}

export interface IRProject {
  name: string
  identifier: string
}

export interface IRComponent {
  name: string
  tree: ComponentNode
  usedCollections: string[]
  usedFlows: string[]
  routeParams: string[]
  needsRouter: boolean
  needsEdem: boolean
  hasFormBindings: boolean
}

export interface IRRoute {
  path: string
  componentName?: string
  redirect?: string
  name: string
  params: string[]
}

export interface IRCollection {
  id: string
  name: string
  fields: IRField[]
  singleton: boolean
}

export interface IRField {
  name: string
  type: string
  tsType: string
  required: boolean
  default?: unknown
  labels?: Record<string, string>
}

export interface IRFlow {
  id: string
  name: string
  trigger: IRFlowTrigger
  nodes: IRFlowNode[]
  edges: IRFlowEdge[]
  meta?: Record<string, unknown>
}

export type IRFlowTrigger =
  | { type: "event"; event: string }
  | { type: "schedule"; every: string }
  | { type: "manual" }

export interface IRFlowNode {
  id: string
  type: string
  position: { x: number; y: number }
  data?: Record<string, unknown>
}

export interface IRFlowEdge {
  id: string
  source: string
  target: string
}

// ── Output File ───────────────────────────────────────────────────────────────

export interface OutputFile {
  path: string
  content: string
}

// ── Stage Interface ───────────────────────────────────────────────────────────

export interface StageInput {
  ir: IR
  output: string
  manifests: unknown
  context: Record<string, unknown>
}

export interface StageOutput {
  files: OutputFile[]
  deps: string[]
}

export interface Stage {
  name: string
  handle(input: StageInput): Promise<StageOutput>
}
