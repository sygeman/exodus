import type { ComponentNode, UIManifest } from "@exodus/edem-ui"
import type { IR, IRComponent, IRRoute, IRCollection, IRFlow, IRFlowTrigger } from "./ir"

// ── Parse manifests → IR ──────────────────────────────────────────────────────

export interface Manifests {
  ui: UIManifest
  data: { collections: DataCollection[] }
  flows: { flows: FlowManifest[] }
}

interface DataCollection {
  id: string
  name: string
  fields: Array<{
    name: string
    type: string
    required?: boolean
    default?: unknown
    labels?: Record<string, string>
  }>
  labels?: Record<string, string>
  singleton?: boolean
}

interface FlowManifest {
  id: string
  name: string
  trigger: { type: string; event?: string; every?: string }
  nodes: Array<{
    id: string
    type: string
    position: { x: number; y: number }
    data?: Record<string, unknown>
  }>
  edges: Array<{
    id: string
    source: string
    target: string
  }>
  meta?: Record<string, unknown>
}

export function parseManifests(manifests: Manifests): IR {
  const components = parseComponents(manifests.ui)
  const routes = parseRoutes(manifests.ui, components)
  const collections = parseCollections(manifests.data)
  const flows = parseFlows(manifests.flows)

  return {
    project: { name: "app", identifier: "app.local" },
    components,
    routes,
    collections,
    flows,
  }
}

// ── Components ────────────────────────────────────────────────────────────────

function parseComponents(ui: UIManifest): IRComponent[] {
  return Object.entries(ui.components).map(([name, tree]) => ({
    name,
    tree,
    usedCollections: extractUsedCollections(tree),
    usedFlows: extractUsedFlows(tree),
    routeParams: [],
    needsRouter: extractNeedsRouter(tree),
    needsEdem: extractNeedsEdem(tree),
    hasFormBindings: extractHasFormBindings(tree),
  }))
}

function extractUsedCollections(node: ComponentNode): string[] {
  const collections = new Set<string>()

  if (node.bind?.collection) {
    collections.add(node.bind.collection)
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      for (const col of extractUsedCollections(child)) {
        collections.add(col)
      }
    }
  }

  return [...collections]
}

function extractUsedFlows(node: ComponentNode): string[] {
  const flows = new Set<string>()

  if (node.events) {
    for (const binding of Object.values(node.events)) {
      if ("flow" in binding) {
        flows.add(binding.flow)
      }
    }
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      for (const flow of extractUsedFlows(child)) {
        flows.add(flow)
      }
    }
  }

  return [...flows]
}

function extractNeedsRouter(node: ComponentNode): boolean {
  if (node.events) {
    for (const binding of Object.values(node.events)) {
      if ("navigate" in binding) return true
    }
  }

  if (Array.isArray(node.children)) {
    return node.children.some(extractNeedsRouter)
  }

  return false
}

function extractNeedsEdem(node: ComponentNode): boolean {
  if (node.events) {
    for (const binding of Object.values(node.events)) {
      if ("flow" in binding) return true
    }
  }

  if (Array.isArray(node.children)) {
    return node.children.some(extractNeedsEdem)
  }

  return false
}

function extractHasFormBindings(node: ComponentNode): boolean {
  if (node.events) {
    for (const binding of Object.values(node.events)) {
      if ("action" in binding) return true
    }
  }

  if (Array.isArray(node.children)) {
    return node.children.some(extractHasFormBindings)
  }

  return false
}

// ── Routes ────────────────────────────────────────────────────────────────────

function parseRoutes(ui: UIManifest, _components: IRComponent[]): IRRoute[] {
  return ui.routes.map((route) => {
    const params = extractParams(route.path)
    const name = route.redirect ? "" : route.root ? kebabCase(route.root) : ""

    return {
      path: route.path,
      componentName: route.root,
      redirect: route.redirect,
      name,
      params,
    }
  })
}

function extractParams(path: string): string[] {
  const params: string[] = []
  const segments = path.split("/")

  for (const segment of segments) {
    if (segment.startsWith(":")) {
      const param = segment
        .slice(1)
        .replace(/\(.*\)/, "")
        .replace(/\?$/, "")
      params.push(param)
    }
  }

  return params
}

// ── Collections ───────────────────────────────────────────────────────────────

function parseCollections(data: { collections: DataCollection[] }): IRCollection[] {
  return data.collections.map((col) => ({
    id: col.id,
    name: col.name,
    fields: col.fields.map((f) => ({
      name: f.name,
      type: f.type,
      tsType: mapFieldType(f.type),
      required: f.required ?? false,
      default: f.default,
      labels: f.labels,
    })),
    singleton: col.singleton ?? false,
  }))
}

function mapFieldType(type: string): string {
  const map: Record<string, string> = {
    string: "string",
    text: "string",
    number: "number",
    boolean: "boolean",
    uuid: "string",
    json: "unknown",
    datetime: "string",
  }
  return map[type] ?? "unknown"
}

// ── Flows ─────────────────────────────────────────────────────────────────────

function parseFlows(flows: { flows: FlowManifest[] }): IRFlow[] {
  return flows.flows.map((flow) => ({
    id: flow.id,
    name: flow.name,
    trigger: parseTrigger(flow.trigger),
    nodes: flow.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: n.data,
    })),
    edges: flow.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
    })),
    meta: flow.meta,
  }))
}

function parseTrigger(trigger: { type: string; event?: string; every?: string }): IRFlowTrigger {
  switch (trigger.type) {
    case "event":
      return { type: "event", event: trigger.event ?? "" }
    case "schedule":
      return { type: "schedule", every: trigger.every ?? "" }
    default:
      return { type: "manual" }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function kebabCase(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()
}
