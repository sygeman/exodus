import type { ComponentNode, Translation } from "@exodus/edem-ui"

// ── Extended ComponentNode ─────────────────────────────────────────────────────
// Adds conditional rendering, modals, teleport, slots, navigation links,
// and skeleton/empty states on top of the base ComponentNode.

export interface ExtendedComponentNode extends Omit<ComponentNode, "children"> {
  children?: ExtendedComponentNode[] | string | Translation

  /** v-if condition: "{{ expr }}" */
  if?: string
  /** v-else-if condition: "{{ expr }}" */
  elseIf?: string
  /** v-else marker */
  else?: boolean

  /** Render as RouterLink with :to binding */
  link?: string
  /** Render as ULink with :to binding */
  ulink?: string

  /** Wrap in UModal — vModel controls open state */
  modal?: {
    vModel: string
    title?: string | Translation
    description?: string | Translation
    footer?: ExtendedComponentNode[]
  }

  /** Wrap in <Teleport to="..."> */
  teleport?: string

  /** Transition classes */
  transition?: {
    enterActiveClass?: string
    enterFromClass?: string
    enterToClass?: string
    leaveActiveClass?: string
    leaveFromClass?: string
    leaveToClass?: string
  }

  /** Named slots — key = slot name, value = node tree */
  namedSlots?: Record<string, ExtendedComponentNode[]>

  /** Skeleton loader shown while loading is true */
  skeleton?: boolean
  /** Empty state shown when collection is empty */
  empty?: {
    icon?: string
    text?: string | Translation
    action?: ExtendedComponentNode
  }
}

// ── Intermediate Representation (IR) ──────────────────────────────────────────
// Framework-agnostic description of the application.
// Generated from manifests (data.json + flows.json + routes.json + platform.json + assets.json).

export interface IR {
  project: IRProject
  components: IRComponent[]
  routes: IRRoute[]
  collections: IRCollection[]
  flows: IRFlow[]
  assets: IRAsset[]
  layout: IRLayoutInfo
  platform: IRPlatformConfig
}

export interface IRProject {
  name: string
  identifier: string
}

export interface IRComponent {
  name: string
  tree: ExtendedComponentNode
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
  children?: IRRoute[]
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

export interface IRAsset {
  name: string
  src: string
}

export interface IRLayoutInfo {
  hasAppLayout: boolean
  hasSidebar: boolean
  hasTopMenu: boolean
  navigation: Array<{ label: string; route: string; icon?: string }>
}

export interface IRPlatformConfig {
  platform: string
  features: {
    consoleLogger?: { collection: string; dedup: boolean; dedupWindow: number }
    windowPersistence?: {
      singleton: string
      fields: string[]
      debounce: number
      minWidth: number
      minHeight: number
    }
    systemDetection?: { singleton: string; fields: string[] }
    updater?: { singleton: string; checkInterval: string }
    devtools?: { accelerator: string }
    splash?: { duration: number }
    waylandWorkaround: boolean
  }
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
  devDeps?: string[]
  scripts?: Record<string, string>
}

export interface Stage {
  name: string
  handle(input: StageInput): Promise<StageOutput>
}
