import { computed, type Ref } from "vue"
import { buildNodeContract, type NodeContractField } from "./flow-node-contract"
import type { DataManifest as ProjectDataManifest } from "./project-manifest-schemas"
import type { ProcedureCatalogModule } from "./procedure-catalog"

export type MapNodeMapping = {
  sourcePath: string
  targetPath: string
  kind?: "source" | "literal"
  literal?: unknown
}

export type GraphNode = {
  id: string
  type: string
  data: Record<string, unknown>
}

export type GraphEdge = {
  id: string
  source: string
  target: string
}

export type ProjectFlowItem = {
  id: string
  data: {
    name?: string
    kind?: unknown
    nodes?: unknown
    edges?: unknown
    valid?: unknown
    validation_errors?: unknown
  }
}

export type MapTreeItem = {
  id: string
  label: string
  path: string
  field: NodeContractField
  mappable: boolean
  defaultExpanded: boolean
  children?: MapTreeItem[]
}

export type MappableTreeItem = {
  id: string
  path: string
  label: string
  field: NodeContractField
}

type UseFlowMapEditorModelInput = {
  nodeId: () => string | null | undefined
  graphNodes: Ref<GraphNode[]>
  graphEdges: Ref<GraphEdge[]>
  projectFlows: Ref<ProjectFlowItem[]>
  procedureCatalog: Ref<ProcedureCatalogModule[]>
  projectDataManifest?: Ref<ProjectDataManifest | null>
  saveGraph?: () => void
}

export function normalizeMapNodeMappings(value: unknown): MapNodeMapping[] {
  if (!Array.isArray(value)) {
    return []
  }

  const normalized: MapNodeMapping[] = []

  for (const entry of value) {
    if (
      typeof entry !== "object" ||
      entry === null ||
      typeof (entry as { targetPath?: unknown }).targetPath !== "string"
    ) {
      continue
    }

    if ((entry as { kind?: unknown }).kind === "literal") {
      normalized.push({
        kind: "literal",
        targetPath: (entry as { targetPath: string }).targetPath,
        literal: (entry as { literal?: unknown }).literal,
        sourcePath: "",
      })
      continue
    }

    if (typeof (entry as { sourcePath?: unknown }).sourcePath !== "string") {
      continue
    }

    normalized.push({
      kind: "source",
      sourcePath: (entry as { sourcePath: string }).sourcePath,
      targetPath: (entry as { targetPath: string }).targetPath,
    })
  }

  return normalized
}

export function normalizeFieldKey(path: string): string {
  const raw = path.split(".").at(-1) ?? path
  return raw.replaceAll("?", "").replaceAll("[", "").replaceAll("]", "").toLowerCase()
}

function getPathDepth(path: string): number {
  return path === "" ? 0 : path.split(".").length
}

export function targetPathCoversPath(targetPath: string, path: string): boolean {
  return targetPath === path || path.startsWith(`${targetPath}.`)
}

function targetPathsConflict(left: string, right: string): boolean {
  return targetPathCoversPath(left, right) || targetPathCoversPath(right, left)
}

function isEndpointItem(item: MappableTreeItem): boolean {
  return item.field.type === "array" || item.field.children.length === 0
}

function isContainerType(type: string): boolean {
  return type === "object" || type === "array"
}

export function canMapFieldToTarget(
  sourceField: NodeContractField,
  targetField: NodeContractField,
): boolean {
  if (sourceField.type === "unknown" || targetField.type === "unknown") {
    return true
  }

  if (targetField.type === "object") {
    return sourceField.type === "object"
  }

  if (targetField.type === "array") {
    return sourceField.type === "array"
  }

  return !isContainerType(sourceField.type)
}

export function findClosestTargetMapping(
  mappings: MapNodeMapping[],
  targetPath: string,
): MapNodeMapping | null {
  let matched: MapNodeMapping | null = null

  for (const mapping of mappings) {
    if (!targetPathCoversPath(mapping.targetPath, targetPath)) {
      continue
    }

    if (!matched || getPathDepth(mapping.targetPath) > getPathDepth(matched.targetPath)) {
      matched = mapping
    }
  }

  return matched
}

export function isTargetPathCovered(mappings: MapNodeMapping[], targetPath: string): boolean {
  return findClosestTargetMapping(mappings, targetPath) !== null
}

export function hasTargetDescendantMapping(
  mappings: MapNodeMapping[],
  targetPath: string,
): boolean {
  return mappings.some((mapping) => mapping.targetPath.startsWith(`${targetPath}.`))
}

export function isTargetPathSatisfied(mappings: MapNodeMapping[], targetPath: string): boolean {
  return (
    isTargetPathCovered(mappings, targetPath) || hasTargetDescendantMapping(mappings, targetPath)
  )
}

export function countCoveredTargetPaths(mappings: MapNodeMapping[], targetPaths: string[]): number {
  return targetPaths.filter((path) => isTargetPathSatisfied(mappings, path)).length
}

export function replaceSourceMapping(
  mappings: MapNodeMapping[],
  targetPath: string,
  sourcePath: string | null,
): MapNodeMapping[] {
  const nextMappings = mappings.filter(
    (mapping) => !targetPathsConflict(mapping.targetPath, targetPath),
  )

  if (!sourcePath) {
    return nextMappings
  }

  nextMappings.push({ kind: "source", sourcePath, targetPath })
  return nextMappings
}

export function replaceLiteralMapping(
  mappings: MapNodeMapping[],
  targetPath: string,
  literal: unknown,
): MapNodeMapping[] {
  const nextMappings = mappings.filter(
    (mapping) => !targetPathsConflict(mapping.targetPath, targetPath),
  )

  if (literal === null || literal === undefined || literal === "") {
    return nextMappings
  }

  nextMappings.push({ kind: "literal", sourcePath: "", targetPath, literal })
  return nextMappings
}

export function getNodeDisplayLabel(node: GraphNode | null): string | null {
  if (!node) {
    return null
  }

  if (typeof node.data.label === "string" && node.data.label.trim() !== "") {
    return node.data.label
  }

  if (
    node.type === "call" &&
    typeof node.data.module === "string" &&
    typeof node.data.procedure === "string"
  ) {
    return `${node.data.module}.${node.data.procedure}`
  }

  return node.type
}

export function useFlowMapEditorModel(input: UseFlowMapEditorModelInput) {
  const currentNode = computed(() => {
    const nodeId = input.nodeId()
    return nodeId ? resolveNodeById(input.graphNodes.value, nodeId) : null
  })

  const mappings = computed<MapNodeMapping[]>(() =>
    normalizeMapNodeMappings(currentNode.value?.data.mappings),
  )

  const incomingNode = computed(() => {
    const nodeId = input.nodeId()
    if (!nodeId) return null
    const edge = input.graphEdges.value.find((candidate) => candidate.target === nodeId)
    return edge ? resolveNodeById(input.graphNodes.value, edge.source) : null
  })

  const outgoingNode = computed(() => {
    const nodeId = input.nodeId()
    if (!nodeId) return null
    const edge = input.graphEdges.value.find((candidate) => candidate.source === nodeId)
    return edge ? resolveNodeById(input.graphNodes.value, edge.target) : null
  })

  const sourceFields = computed(() =>
    getOutputFieldsForNode({
      nodeId: incomingNode.value?.id ?? null,
      graphNodes: input.graphNodes.value,
      graphEdges: input.graphEdges.value,
      procedureCatalog: input.procedureCatalog.value,
      projectFlows: input.projectFlows.value,
      projectDataManifest: input.projectDataManifest?.value ?? null,
      visited: new Set(),
    }),
  )

  const targetFields = computed(() =>
    getInputFieldsForNode({
      nodeId: outgoingNode.value?.id ?? null,
      graphNodes: input.graphNodes.value,
      graphEdges: input.graphEdges.value,
      procedureCatalog: input.procedureCatalog.value,
      projectFlows: input.projectFlows.value,
      projectDataManifest: input.projectDataManifest?.value ?? null,
      visited: new Set(),
    }),
  )

  const sourceItems = computed(() =>
    sourceFields.value.map((field, index) => toTreeItem(field, `source-${index}`)),
  )
  const targetItems = computed(() =>
    targetFields.value.map((field, index) => toTreeItem(field, `target-${index}`)),
  )

  const sourceMappableItems = computed(() => collectMappableItems(sourceItems.value))
  const targetMappableItems = computed(() => collectMappableItems(targetItems.value))
  const sourceLeafItems = computed(() => sourceMappableItems.value.filter(isEndpointItem))
  const targetLeafItems = computed(() => targetMappableItems.value.filter(isEndpointItem))

  const sourcePathLabelMap = computed(() => buildPathLabelMap(sourceItems.value))
  const requiredTargetLeafPaths = computed(() =>
    targetLeafItems.value.filter((item) => item.field.required === true).map((item) => item.path),
  )

  const mappedTargetCount = computed(() => {
    return countCoveredTargetPaths(
      mappings.value,
      targetLeafItems.value.map((item) => item.path),
    )
  })

  const totalTargetCount = computed(() => targetLeafItems.value.length)
  const missingRequiredCount = computed(() => {
    return requiredTargetLeafPaths.value.filter(
      (path) => !isTargetPathSatisfied(mappings.value, path),
    ).length
  })

  function replaceMappings(nextMappings: MapNodeMapping[]): void {
    if (!currentNode.value || !input.saveGraph) {
      return
    }

    input.graphNodes.value = input.graphNodes.value.map((node) => {
      if (node.id !== currentNode.value?.id) {
        return node
      }

      return {
        ...node,
        data: {
          ...node.data,
          mappings: nextMappings,
        },
      }
    })

    input.saveGraph()
  }

  function getMappedSourcePath(targetPath: string): string | null {
    const mapping = mappings.value.find((candidate) => candidate.targetPath === targetPath)
    if (!mapping || mapping.kind === "literal" || mapping.sourcePath === "") {
      return null
    }

    return mapping.sourcePath
  }

  function getMappedSourceLabel(targetPath: string): string | null {
    const sourcePath = getMappedSourcePath(targetPath)
    if (!sourcePath) {
      return null
    }

    return sourcePathLabelMap.value.get(sourcePath) ?? sourcePath
  }

  return {
    currentNode,
    incomingNode,
    outgoingNode,
    mappings,
    sourceFields,
    targetFields,
    sourceItems,
    targetItems,
    sourceMappableItems,
    targetMappableItems,
    sourceLeafItems,
    targetLeafItems,
    sourcePathLabelMap,
    requiredTargetLeafPaths,
    mappedTargetCount,
    totalTargetCount,
    missingRequiredCount,
    replaceMappings,
    getMappedSourcePath,
    getMappedSourceLabel,
  }
}

function resolveNodeById(graphNodes: GraphNode[], nodeId: string): GraphNode | null {
  return graphNodes.find((node) => node.id === nodeId) ?? null
}

function getOutputFieldsForNode(input: {
  nodeId: string | null
  graphNodes: GraphNode[]
  graphEdges: GraphEdge[]
  procedureCatalog: ProcedureCatalogModule[]
  projectFlows: ProjectFlowItem[]
  projectDataManifest: ProjectDataManifest | null
  visited: Set<string>
}): NodeContractField[] {
  if (!input.nodeId || input.visited.has(input.nodeId)) {
    return []
  }

  input.visited.add(input.nodeId)
  const node = resolveNodeById(input.graphNodes, input.nodeId)
  if (!node) {
    return []
  }

  if (node.type === "map") {
    const nextEdge = input.graphEdges.find((edge) => edge.source === input.nodeId)
    return getInputFieldsForNode({ ...input, nodeId: nextEdge?.target ?? null })
  }

  return buildNodeContract({
    node,
    procedureCatalog: input.procedureCatalog,
    projectFlows: input.projectFlows,
    projectDataManifest: input.projectDataManifest,
    graphNodes: input.graphNodes,
    graphEdges: input.graphEdges,
  }).output.fields
}

function getInputFieldsForNode(input: {
  nodeId: string | null
  graphNodes: GraphNode[]
  graphEdges: GraphEdge[]
  procedureCatalog: ProcedureCatalogModule[]
  projectFlows: ProjectFlowItem[]
  projectDataManifest: ProjectDataManifest | null
  visited: Set<string>
}): NodeContractField[] {
  if (!input.nodeId || input.visited.has(input.nodeId)) {
    return []
  }

  input.visited.add(input.nodeId)
  const node = resolveNodeById(input.graphNodes, input.nodeId)
  if (!node) {
    return []
  }

  if (node.type === "map") {
    const prevEdge = input.graphEdges.find((edge) => edge.target === input.nodeId)
    return getOutputFieldsForNode({ ...input, nodeId: prevEdge?.source ?? null })
  }

  return buildNodeContract({
    node,
    procedureCatalog: input.procedureCatalog,
    projectFlows: input.projectFlows,
    projectDataManifest: input.projectDataManifest,
    graphNodes: input.graphNodes,
    graphEdges: input.graphEdges,
  }).input.fields
}

function buildPathLabelMap(items: MapTreeItem[]): Map<string, string> {
  const map = new Map<string, string>()

  function walk(itemList: MapTreeItem[]): void {
    for (const item of itemList) {
      map.set(item.path, item.label)
      if (item.children) {
        walk(item.children)
      }
    }
  }

  walk(items)
  return map
}

function collectMappableItems(items: MapTreeItem[]): MappableTreeItem[] {
  const result: MappableTreeItem[] = []

  function walk(itemList: MapTreeItem[]): void {
    for (const item of itemList) {
      if (item.mappable) {
        result.push({
          id: item.id,
          path: item.path,
          label: item.label,
          field: item.field,
        })
      }
      if (item.children) {
        walk(item.children)
      }
    }
  }

  walk(items)
  return result
}

function toTreeItem(
  field: NodeContractField,
  id: string,
  parentPath = "",
  insideArrayItem = false,
): MapTreeItem {
  const path = parentPath === "" ? field.name : `${parentPath}.${field.name}`
  const label = field.required === false ? `${field.name}?` : field.name
  const canMapWholeValue = field.type === "array" || field.type === "object"
  const mappable = !insideArrayItem && (field.children.length === 0 || canMapWholeValue)

  return {
    id,
    label,
    path,
    field,
    mappable,
    defaultExpanded: field.children.length > 0,
    children:
      field.children.length > 0
        ? field.children.map((child, index) =>
            toTreeItem(child, `${id}-${index}`, path, insideArrayItem || field.type === "array"),
          )
        : undefined,
  }
}
