import type { ComponentNode, UIManifest } from "@exodus/edem-ui"
import type {
  IR,
  IRComponent,
  IRRoute,
  IRCollection,
  IRFlow,
  IRFlowTrigger,
  IRLayoutInfo,
  IRPlatformConfig,
} from "./ir"

// ── Parse manifests → IR ──────────────────────────────────────────────────────

export interface Manifests {
  ui: UIManifest
  components: Record<string, ComponentNode>
  data: { collections: DataCollection[] }
  flows: { flows: FlowManifest[] }
  platform?: PlatformManifest
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

interface PlatformManifest {
  platform: string
  features: Record<string, unknown>
}

export function parseManifests(manifests: Manifests, projectName?: string): IR {
  const components = parseComponents(manifests.components)
  const routes = parseRoutes(manifests.ui, components)
  const collections = parseCollections(manifests.data)
  const flows = parseFlows(manifests.flows)
  const layout = parseLayout(manifests.components)
  const platform = parsePlatform(manifests.platform)

  return {
    project: { name: projectName ?? "app", identifier: `${projectName ?? "app"}.local` },
    components,
    routes,
    collections,
    flows,
    layout,
    platform,
  }
}

// ── Components ────────────────────────────────────────────────────────────────

function parseComponents(components: Record<string, ComponentNode>): IRComponent[] {
  return Object.entries(components).map(([name, tree]) => ({
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

  if (node.bind?.item) {
    for (const col of extractUsedCollections(node.bind.item)) {
      collections.add(col)
    }
  }

  if (node.modal) {
    if (node.modal.footer) {
      for (const child of node.modal.footer) {
        for (const col of extractUsedCollections(child)) collections.add(col)
      }
    }
  }

  if (node.namedSlots) {
    for (const slotNodes of Object.values(node.namedSlots)) {
      for (const child of slotNodes) {
        for (const col of extractUsedCollections(child)) collections.add(col)
      }
    }
  }

  if (node.empty?.action) {
    for (const col of extractUsedCollections(node.empty.action)) collections.add(col)
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

  if (node.bind?.item) {
    for (const flow of extractUsedFlows(node.bind.item)) flows.add(flow)
  }

  if (node.modal) {
    if (node.modal.footer) {
      for (const child of node.modal.footer) {
        for (const flow of extractUsedFlows(child)) flows.add(flow)
      }
    }
  }

  if (node.namedSlots) {
    for (const slotNodes of Object.values(node.namedSlots)) {
      for (const child of slotNodes) {
        for (const flow of extractUsedFlows(child)) flows.add(flow)
      }
    }
  }

  if (node.empty?.action) {
    for (const flow of extractUsedFlows(node.empty.action)) flows.add(flow)
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
  if (node.link) return true

  if (node.events) {
    for (const binding of Object.values(node.events)) {
      if ("navigate" in binding) return true
    }
  }

  if (node.bind?.item && extractNeedsRouter(node.bind.item)) return true

  if (node.modal) {
    if (node.modal.footer?.some(extractNeedsRouter)) return true
  }

  if (node.namedSlots) {
    for (const slotNodes of Object.values(node.namedSlots)) {
      if (slotNodes.some(extractNeedsRouter)) return true
    }
  }

  if (node.empty?.action && extractNeedsRouter(node.empty.action)) return true

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

  if (node.bind?.item && extractNeedsEdem(node.bind.item)) return true

  if (node.modal) {
    if (node.modal.footer?.some(extractNeedsEdem)) return true
  }

  if (node.namedSlots) {
    for (const slotNodes of Object.values(node.namedSlots)) {
      if (slotNodes.some(extractNeedsEdem)) return true
    }
  }

  if (node.empty?.action && extractNeedsEdem(node.empty.action)) return true

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

  if (node.bind?.item && extractHasFormBindings(node.bind.item)) return true

  if (node.modal) {
    if (node.modal.footer?.some(extractHasFormBindings)) return true
  }

  if (node.namedSlots) {
    for (const slotNodes of Object.values(node.namedSlots)) {
      if (slotNodes.some(extractHasFormBindings)) return true
    }
  }

  if (node.empty?.action && extractHasFormBindings(node.empty.action)) return true

  if (Array.isArray(node.children)) {
    return node.children.some(extractHasFormBindings)
  }

  return false
}

// ── Routes ────────────────────────────────────────────────────────────────────

function parseRoutes(ui: UIManifest, _components: IRComponent[]): IRRoute[] {
  return ui.routes.map((route) => parseRoute(route))
}

function parseRoute(route: UIManifest["routes"][0]): IRRoute {
  const params = extractParams(route.path)
  const name = route.redirect ? "" : route.root ? kebabCase(route.root) : ""

  const irRoute: IRRoute = {
    path: route.path,
    componentName: route.root,
    redirect: typeof route.redirect === "string" ? route.redirect : undefined,
    name,
    params,
  }

  if (route.children && route.children.length > 0) {
    irRoute.children = route.children.map((child) => parseRoute(child))
  }

  return irRoute
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

// ── Layout ────────────────────────────────────────────────────────────────────

function parseLayout(components: Record<string, ComponentNode>): IRLayoutInfo {
  const hasAppLayout = "AppLayout" in components
  const hasSidebar = "AppSidebar" in components
  const hasTopMenu = "AppTopMenu" in components

  const navigation: IRLayoutInfo["navigation"] = []
  if (hasSidebar) {
    const sidebar = components["AppSidebar"]
    extractNavigation(sidebar, navigation)
  }

  return { hasAppLayout, hasSidebar, hasTopMenu, navigation }
}

function extractNavigation(node: ComponentNode, navigation: IRLayoutInfo["navigation"]): void {
  if (node.bind?.items && Array.isArray(node.bind.items)) {
    for (const item of node.bind.items) {
      if (typeof item === "object" && item !== null && "label" in item && "to" in item) {
        const nav = item as { label: string; to: string; icon?: string }
        navigation.push({ label: nav.label, route: nav.to, icon: nav.icon })
      }
    }
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      extractNavigation(child, navigation)
    }
  }
}

// ── Platform ──────────────────────────────────────────────────────────────────

function parsePlatform(platform?: PlatformManifest): IRPlatformConfig {
  if (!platform) {
    return {
      platform: "electrobun",
      features: {
        waylandWorkaround: false,
      },
    }
  }

  const f = platform.features ?? {}
  return {
    platform: platform.platform ?? "electrobun",
    features: {
      consoleLogger: f["console-logger"] as IRPlatformConfig["features"]["consoleLogger"],
      windowPersistence: f[
        "window-persistence"
      ] as IRPlatformConfig["features"]["windowPersistence"],
      systemDetection: f["system-detection"] as IRPlatformConfig["features"]["systemDetection"],
      updater: f["updater"] as IRPlatformConfig["features"]["updater"],
      devtools: f["devtools"] as IRPlatformConfig["features"]["devtools"],
      waylandWorkaround: !!f["wayland-workaround"],
    },
  }
}
