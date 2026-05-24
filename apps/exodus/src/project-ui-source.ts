import type { ComponentNode, Route, RoutesManifest } from "@/project-manifest-schemas"

export type ProjectUiComponentSourceItem = {
  id: string
  data: {
    manifest_id?: unknown
    name?: unknown
    tree?: unknown
  }
}

export type ProjectUiRouteSourceItem = {
  id: string
  data: {
    manifest_id?: unknown
    path?: unknown
    root?: unknown
    redirect?: unknown
    parent_manifest_id?: unknown
    sort_order?: unknown
  }
}

export type NormalizedProjectUiRoute = {
  id: string
  manifestId: string
  path: string
  root?: string
  redirect?: string
  parentManifestId?: string
  sortOrder: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function getProjectUiComponentName(item: ProjectUiComponentSourceItem): string {
  if (typeof item.data.name === "string" && item.data.name.trim() !== "") {
    return item.data.name
  }

  if (typeof item.data.manifest_id === "string" && item.data.manifest_id.trim() !== "") {
    return item.data.manifest_id
  }

  return item.id
}

export function getProjectUiComponentManifestId(item: ProjectUiComponentSourceItem): string {
  return typeof item.data.manifest_id === "string" && item.data.manifest_id.trim() !== ""
    ? item.data.manifest_id
    : item.id
}

export function getProjectUiComponentTree(item: ProjectUiComponentSourceItem): ComponentNode {
  if (isRecord(item.data.tree) && typeof item.data.tree.component === "string") {
    return item.data.tree as unknown as ComponentNode
  }

  return {
    component: "div",
    children: [],
  }
}

export function buildProjectUiComponentsManifest(
  items: ProjectUiComponentSourceItem[],
): Record<string, ComponentNode> {
  return Object.fromEntries(
    items.map((item) => [getProjectUiComponentManifestId(item), getProjectUiComponentTree(item)]),
  )
}

export function normalizeProjectUiRoute(item: ProjectUiRouteSourceItem): NormalizedProjectUiRoute {
  return {
    id: item.id,
    manifestId:
      typeof item.data.manifest_id === "string" && item.data.manifest_id.trim() !== ""
        ? item.data.manifest_id
        : item.id,
    path: typeof item.data.path === "string" && item.data.path.trim() !== "" ? item.data.path : "/",
    root:
      typeof item.data.root === "string" && item.data.root.trim() !== ""
        ? item.data.root
        : undefined,
    redirect:
      typeof item.data.redirect === "string" && item.data.redirect.trim() !== ""
        ? item.data.redirect
        : undefined,
    parentManifestId:
      typeof item.data.parent_manifest_id === "string" && item.data.parent_manifest_id.trim() !== ""
        ? item.data.parent_manifest_id
        : undefined,
    sortOrder: typeof item.data.sort_order === "number" ? item.data.sort_order : 0,
  }
}

function compareRoutes(left: NormalizedProjectUiRoute, right: NormalizedProjectUiRoute): number {
  if (left.sortOrder !== right.sortOrder) {
    return left.sortOrder - right.sortOrder
  }

  if (left.path !== right.path) {
    return left.path.localeCompare(right.path)
  }

  return left.manifestId.localeCompare(right.manifestId)
}

function buildRouteNode(
  route: NormalizedProjectUiRoute,
  childrenByParent: Map<string | undefined, NormalizedProjectUiRoute[]>,
  visited: Set<string>,
): Route {
  if (visited.has(route.manifestId)) {
    return {
      path: route.path,
      root: route.root,
      redirect: route.redirect,
    }
  }

  visited.add(route.manifestId)

  const children = (childrenByParent.get(route.manifestId) ?? []).map((child) =>
    buildRouteNode(child, childrenByParent, new Set(visited)),
  )

  return {
    path: route.path,
    root: route.root,
    redirect: route.redirect,
    children: children.length > 0 ? children : undefined,
  }
}

export function buildProjectUiRoutesManifest(items: ProjectUiRouteSourceItem[]): RoutesManifest {
  const normalized = items.map((item) => normalizeProjectUiRoute(item)).toSorted(compareRoutes)
  const byParent = new Map<string | undefined, NormalizedProjectUiRoute[]>()

  for (const route of normalized) {
    const bucket = byParent.get(route.parentManifestId) ?? []
    byParent.set(route.parentManifestId, [...bucket, route].toSorted(compareRoutes))
  }

  const routes = (byParent.get(undefined) ?? []).map((route) =>
    buildRouteNode(route, byParent, new Set()),
  )

  return {
    routes,
    components: {},
  }
}
