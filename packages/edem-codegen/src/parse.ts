import type { ComponentNode, RoutesManifest } from "@exodus/edem-ui"
import type {
  IR,
  IRComponent,
  IRRoute,
  IRCollection,
  IRFlow,
  IRFlowTrigger,
  IRAsset,
  IRLayoutInfo,
  IRPlatformConfig,
  ExtendedComponentNode,
} from "./ir"
import { kebabCase } from "./utils"
import { collectFromTree, someInTree } from "./walker"

// ── Parse manifests → IR ──────────────────────────────────────────────────────

export interface Manifests {
  routes: RoutesManifest
  components: Record<string, ComponentNode>
  data: { collections: DataCollection[] }
  flows: { flows: FlowManifest[] }
  assets?: AssetsManifest
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

interface AssetsManifest {
  assets: Array<{ name: string; src: string }>
}

export function parseManifests(manifests: Manifests, projectName?: string): IR {
  const components = parseComponents(manifests.components)
  const routes = parseRoutes(manifests.routes)
  const collections = parseCollections(manifests.data)
  const flows = parseFlows(manifests.flows)
  const assets = parseAssets(manifests.assets)
  const layout = parseLayout(manifests.components)
  const platform = parsePlatform(manifests.platform)

  return {
    project: { name: projectName ?? "app", identifier: `${projectName ?? "app"}.local` },
    components,
    routes,
    collections,
    flows,
    assets,
    layout,
    platform,
  }
}

// ── Components ────────────────────────────────────────────────────────────────

function parseComponents(components: Record<string, ComponentNode>): IRComponent[] {
  return Object.entries(components).map(([name, tree]) => ({
    name,
    tree: tree as ExtendedComponentNode,
    usedCollections: extractUsedCollections(tree as ExtendedComponentNode),
    usedFlows: extractUsedFlows(tree as ExtendedComponentNode),
    routeParams: [],
    needsRouter: extractNeedsRouter(tree as ExtendedComponentNode),
    needsEdem: extractNeedsEdem(tree as ExtendedComponentNode),
    hasFormBindings: extractHasFormBindings(tree as ExtendedComponentNode),
  }))
}

function extractUsedCollections(node: ExtendedComponentNode): string[] {
  return collectFromTree(node, (n) => {
    const cols: string[] = []
    if (n.bind?.collection) cols.push(n.bind.collection)
    if (n.events) {
      for (const binding of Object.values(n.events)) {
        if ("action" in binding && binding.collection) cols.push(binding.collection)
      }
    }
    return cols
  })
}

function extractUsedFlows(node: ExtendedComponentNode): string[] {
  return collectFromTree(node, (n) => {
    if (!n.events) return []
    return Object.values(n.events)
      .filter((b): b is { flow: string } & Record<string, unknown> => "flow" in b)
      .map((b) => b.flow)
  })
}

function extractNeedsRouter(node: ExtendedComponentNode): boolean {
  return someInTree(node, (n) => {
    if (n.link) return true
    if (n.events) {
      for (const binding of Object.values(n.events)) {
        if ("navigate" in binding) return true
      }
    }
    return false
  })
}

function extractNeedsEdem(node: ExtendedComponentNode): boolean {
  return someInTree(node, (n) => {
    if (!n.events) return false
    return Object.values(n.events).some((b) => "flow" in b)
  })
}

function extractHasFormBindings(node: ExtendedComponentNode): boolean {
  return someInTree(node, (n) => {
    if (!n.events) return false
    return Object.values(n.events).some((b) => "action" in b)
  })
}

// ── Routes ────────────────────────────────────────────────────────────────────

function parseRoutes(routes: RoutesManifest): IRRoute[] {
  return routes.routes.map((route) => parseRoute(route))
}

function parseRoute(route: RoutesManifest["routes"][0]): IRRoute {
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

// ── Assets ────────────────────────────────────────────────────────────────────

function parseAssets(manifest?: AssetsManifest): IRAsset[] {
  if (!manifest?.assets) return []
  return manifest.assets.map((a) => ({ name: a.name, src: a.src }))
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
      splash: f["splash"] as IRPlatformConfig["features"]["splash"],
      waylandWorkaround: !!f["wayland-workaround"],
    },
  }
}
