<script setup lang="ts">
import { ref, computed, watch, provide, markRaw } from "vue"
import { useRoute } from "vue-router"
import {
  VueFlow,
  useVueFlow,
  type Connection,
  type NodeChange,
  type EdgeChange,
} from "@vue-flow/core"
import { Background } from "@vue-flow/background"
import { edem } from "@/edem"
import { useCollectionQuery } from "@/hooks"
import { PROJECT_FLOW_SOURCE_COLLECTION } from "@/flow-collections"
import { useFlowHighlighting } from "@/composables/useFlowHighlighting"
import FlowNode from "@/components/FlowNode.vue"
import DeletableEdge from "@/components/DeletableEdge.vue"
import FlowNodeConfigPanel from "@/components/FlowNodeConfigPanel.vue"
import { normalizeProjectFlowGraph } from "@/project-flow-normalization"
import { normalizeProcedureCatalog, type ProcedureCatalogModule } from "@/procedure-catalog"
import { validateProjectFlow } from "@/project-flow-validation"
import {
  getFlowKind,
  getTriggerNodeData,
  type StoredFlowEdge,
  type StoredFlowNode,
} from "@/types/flow"

const route = useRoute()
const projectId = computed(() => route.params.id as string)
const flowId = computed(() => route.params.flowId as string)
const graphUpdateSource = `project-flow-graph:${crypto.randomUUID()}`

const { data: flows } = useCollectionQuery(PROJECT_FLOW_SOURCE_COLLECTION, () => ({
  filter: { project_id: { _eq: projectId.value } },
}))

type FlowItem = {
  id: string
  source?: string | null
  data: {
    name?: string
    kind?: unknown
    nodes?: unknown
    edges?: unknown
    meta?: unknown
    valid?: unknown
    validation_errors?: unknown
  }
}

const flow = computed(() => flows.value.find((f) => f.id === flowId.value) as FlowItem | undefined)
const flowKind = computed(() => getFlowKind(flow.value?.data.kind))

const { viewport, setViewport, onMoveEnd, screenToFlowCoordinate } = useVueFlow()

interface FlowMeta {
  viewport?: { x: number; y: number; zoom: number }
  selectedNodeId?: string
}

function normalizeNodeForStorage(node: StoredFlowNode): StoredFlowNode {
  if (node.type === "call") {
    return {
      ...node,
      data: {
        ...node.data,
        testMode: undefined,
        status: undefined,
        error: undefined,
        progress: undefined,
      },
    }
  }

  return {
    ...node,
    data: {
      ...node.data,
      testMode: undefined,
      status: undefined,
      error: undefined,
      progress: undefined,
    },
  }
}

type GraphNodeView = {
  id: string
  type: string
  position: { x: number; y: number }
  data: Record<string, unknown>
  class?: string
}

type GraphEdgeView = {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  label?: string
  type?: string
  style?: { stroke: string }
  animated?: boolean
}

const NODE_TYPE_MAP: Record<string, string> = {
  trigger: "trigger",
  call: "call",
  transform: "transform",
  delay: "delay",
  condition: "condition",
  switch: "switch",
  fork: "fork",
  join: "join",
  loop: "loop",
  input: "input",
  output: "output",
  subflow: "subflow",
}

const REVERSE_TYPE_MAP: Record<string, string> = {
  trigger: "trigger",
  call: "call",
  condition: "condition",
  switch: "switch",
  loop: "loop",
  delay: "delay",
  transform: "transform",
  fork: "fork",
  join: "join",
  input: "input",
  output: "output",
  subflow: "subflow",
}

const vfNodes = ref<GraphNodeView[]>([])

const vfEdges = ref<GraphEdgeView[]>([])

const procedureCatalog = ref<ProcedureCatalogModule[]>([])
const procedureCatalogLoading = ref(false)
const procedureCatalogError = ref<string | null>(null)

const suppressAutoSave = ref(false)
const hydratedFlowId = ref<string | null>(null)
const restoringViewport = ref(false)
let flowUpdateQueue: Promise<void> = Promise.resolve()

function buildRawStoredNodes(): StoredFlowNode[] {
  return vfNodes.value.map((node) =>
    normalizeNodeForStorage({
      id: node.id,
      type:
        ((node.data as Record<string, unknown>)?.nodeType as string) ||
        REVERSE_TYPE_MAP[node.type] ||
        "call",
      position: node.position,
      data: node.data,
    } as StoredFlowNode),
  )
}

function buildRawStoredEdges(): StoredFlowEdge[] {
  return vfEdges.value.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    label: edge.label,
  })) as StoredFlowEdge[]
}

function buildNormalizedStoredGraph() {
  return normalizeProjectFlowGraph({
    kind: flowKind.value,
    nodes: buildRawStoredNodes(),
    edges: buildRawStoredEdges(),
    procedureCatalog: procedureCatalog.value,
  })
}

function getStoredGraphSignature(input: {
  nodes: StoredFlowNode[]
  edges: StoredFlowEdge[]
}): string {
  return JSON.stringify({ nodes: input.nodes, edges: input.edges })
}

function updateFlowItem(itemId: string, data: Record<string, unknown>) {
  const run = flowUpdateQueue.then(async () => {
    await edem.data.updateItem({
      item_id: itemId,
      data,
      source: graphUpdateSource,
    })
  })

  flowUpdateQueue = run.catch(() => {})
  return run
}

async function loadProcedureCatalog() {
  if (procedureCatalogLoading.value) return

  procedureCatalogLoading.value = true
  procedureCatalogError.value = null

  try {
    const result = await edem.flows.getProcedureCatalog(undefined)
    procedureCatalog.value = normalizeProcedureCatalog(result.modules)
  } catch (error) {
    procedureCatalogError.value = error instanceof Error ? error.message : String(error)
    console.error("[project-flows] Failed to load procedure catalog:", error)
  } finally {
    procedureCatalogLoading.value = false
  }
}

void loadProcedureCatalog()

watch(
  [flow, procedureCatalog],
  ([f, currentProcedureCatalog]) => {
    if (!f) return
    const flowChanged = hydratedFlowId.value !== f.id

    if (!flowChanged && f.source === graphUpdateSource) {
      hydratedFlowId.value = f.id
      return
    }

    suppressAutoSave.value = true
    cancelPendingSave()
    const currentSelectedNodeId = selectedNodeId.value
    const rawNodes = (f.data.nodes ?? []) as StoredFlowNode[]
    const rawEdges = (f.data.edges ?? []) as StoredFlowEdge[]
    const normalized = normalizeProjectFlowGraph({
      kind: getFlowKind(f.data.kind),
      nodes: rawNodes,
      edges: rawEdges,
      procedureCatalog: currentProcedureCatalog,
    })

    const currentGraphSignature = getStoredGraphSignature(buildNormalizedStoredGraph())
    const nextGraphSignature = getStoredGraphSignature({
      nodes: normalized.nodes,
      edges: normalized.edges,
    })

    if (flowChanged || currentGraphSignature !== nextGraphSignature) {
      vfNodes.value = normalized.nodes.map((n) => ({
        id: n.id,
        type: NODE_TYPE_MAP[n.type] || "action",
        position: n.position,
        data:
          n.type === "trigger"
            ? {
                ...n.data,
                ...getTriggerNodeData(normalized.trigger),
                label: typeof n.data?.label === "string" ? n.data.label : "Trigger",
                nodeType: n.type,
              }
            : { ...n.data, nodeType: n.type },
      }))
      vfEdges.value = normalized.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        label: e.label,
        type: "deleteable",
      }))
    }

    const meta = (f.data.meta ?? {}) as FlowMeta
    selectedNodeId.value =
      currentSelectedNodeId && normalized.nodes.some((node) => node.id === currentSelectedNodeId)
        ? currentSelectedNodeId
        : null
    if (flowChanged && meta.viewport) {
      restoringViewport.value = true
      void Promise.resolve(setViewport(meta.viewport)).finally(() => {
        restoringViewport.value = false
      })
    }
    hydratedFlowId.value = f.id
    suppressAutoSave.value = false
    applyHighlighting()

    if (
      JSON.stringify(rawNodes) !== JSON.stringify(normalized.nodes) ||
      JSON.stringify(rawEdges) !== JSON.stringify(normalized.edges)
    ) {
      void updateFlowItem(f.id, {
        nodes: normalized.nodes,
        edges: normalized.edges,
      }).catch((error) => {
        console.error("[project-flows] Failed to persist normalized source graph:", error)
      })
    }
  },
  { immediate: true },
)

const FlowNodeRaw = markRaw(FlowNode)

const nodeTypes = {
  trigger: FlowNodeRaw,
  call: FlowNodeRaw,
  condition: FlowNodeRaw,
  switch: FlowNodeRaw,
  loop: FlowNodeRaw,
  delay: FlowNodeRaw,
  transform: FlowNodeRaw,
  fork: FlowNodeRaw,
  join: FlowNodeRaw,
  subflow: FlowNodeRaw,
  input: FlowNodeRaw,
  output: FlowNodeRaw,
}

const edgeTypes = {
  deleteable: markRaw(DeletableEdge),
}

const selectedNodeId = ref<string | null>(null)

const validationState = computed(() =>
  validateProjectFlow({
    kind: flowKind.value,
    nodes: vfNodes.value.map((node) => ({
      id: node.id,
      type:
        ((node.data as Record<string, unknown>)?.nodeType as string) ||
        REVERSE_TYPE_MAP[node.type] ||
        "call",
      position: node.position,
      data: node.data,
    })),
    edges: vfEdges.value.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      label: edge.label,
    })),
    procedureCatalog: procedureCatalog.value,
  }),
)

watch([flow, procedureCatalog], ([currentFlow, currentProcedureCatalog]) => {
  if (!currentFlow) return

  const nodes = (currentFlow.data.nodes ?? []) as StoredFlowNode[]
  const edges = (currentFlow.data.edges ?? []) as StoredFlowEdge[]
  const validation = validateProjectFlow({
    kind: getFlowKind(currentFlow.data.kind),
    nodes,
    edges,
    procedureCatalog: currentProcedureCatalog,
  })
  const currentErrors = Array.isArray(currentFlow.data.validation_errors)
    ? currentFlow.data.validation_errors.filter(
        (error): error is string => typeof error === "string",
      )
    : []

  if (
    currentFlow.data.valid === validation.valid &&
    currentErrors.length === validation.errors.length &&
    currentErrors.every((error, index) => error === validation.errors[index])
  ) {
    return
  }

  void updateFlowItem(currentFlow.id, {
    valid: validation.valid,
    validation_errors: validation.errors,
  }).catch((error) => {
    console.error("[project-flows] Failed to sync validation state:", error)
  })
})

const { highlightedNodeIds, applyEdgeHighlighting } = useFlowHighlighting(
  vfNodes,
  vfEdges,
  selectedNodeId,
)

function applyHighlighting() {
  const highlighted = highlightedNodeIds.value
  const hasSelection = !!selectedNodeId.value
  for (const node of vfNodes.value) {
    const classes: string[] = []
    if (hasSelection && !highlighted.has(node.id)) {
      classes.push("node-dimmed")
    }
    node.class = classes.join(" ") || undefined
  }
  applyEdgeHighlighting()
}

watch(selectedNodeId, () => {
  applyHighlighting()
})

// --- Node selection ---
function onNodeClick({ node }: { node: { id: string } }) {
  selectedNodeId.value = node.id
}

function onNodeDragStart({ node }: { node: { id: string } }) {
  selectedNodeId.value = node.id
}

function onPaneClick() {
  selectedNodeId.value = null
}

onMoveEnd(() => {
  saveToDb()
})

// --- Connect start/end: drag handle to empty space -> create node ---
const connectingFrom = ref<{ nodeId: string; handleId: string | null } | null>(null)

function onConnectStart(params: { nodeId?: string; handleId?: string | null }) {
  if (params.nodeId) {
    connectingFrom.value = {
      nodeId: params.nodeId,
      handleId: params.handleId ?? null,
    }
  }
}

function onConnectEnd(event?: MouseEvent | TouchEvent) {
  if (!connectingFrom.value || !event) return
  const target = event.target as HTMLElement
  const isOnNode = target.closest(".vue-flow__node")
  const isOnHandle = target.closest(".vue-flow__handle")
  if (!isOnNode && !isOnHandle) {
    const clientX = "clientX" in event ? event.clientX : event.changedTouches[0].clientX
    const clientY = "clientY" in event ? event.clientY : event.changedTouches[0].clientY
    handleAddNodeFromEdge(connectingFrom.value.nodeId, connectingFrom.value.handleId, {
      x: clientX,
      y: clientY,
    })
  }
  connectingFrom.value = null
}

// --- Connect two existing nodes ---
function onConnect(connection: Connection) {
  if (!connection.source || !connection.target) return
  if (connection.source === connection.target) return

  const exists = vfEdges.value.some(
    (e) =>
      e.source === connection.source &&
      e.target === connection.target &&
      e.sourceHandle === connection.sourceHandle,
  )
  if (exists) return

  const newEdge = {
    id: `e-${connection.source}-${connection.target}-${Date.now()}`,
    source: connection.source,
    target: connection.target,
    sourceHandle: connection.sourceHandle ?? undefined,
    targetHandle: connection.targetHandle ?? undefined,
    type: "deleteable",
  }
  vfEdges.value = [...vfEdges.value, newEdge]
  saveToDb()
}

// --- Node drag -> save positions ---
function onNodesChange(changes: NodeChange[]) {
  let positionChanged = false
  for (const change of changes) {
    if (change.type === "position" && change.position) {
      const node = vfNodes.value.find((n) => n.id === change.id)
      if (node) {
        node.position = change.position
        positionChanged = true
      }
    }
  }
  if (positionChanged) saveToDb()
}

// --- Edge removal (delete key / programmatic) ---
function onEdgesChange(changes: EdgeChange[]) {
  for (const change of changes) {
    if (change.type === "remove") {
      vfEdges.value = vfEdges.value.filter((e) => e.id !== change.id)
      saveToDb()
    }
  }
}

// --- Add node from edge drag ---
function handleAddNodeFromEdge(
  sourceNodeId: string,
  sourceHandle: string | null,
  mousePosition?: { x: number; y: number },
) {
  const sourceNode = vfNodes.value.find((n) => n.id === sourceNodeId)
  const pos = mousePosition
    ? screenToFlowCoordinate(mousePosition)
    : {
        x: sourceNode?.position.x ?? 250,
        y: (sourceNode?.position.y ?? 0) + 120,
      }
  const newNodeId = crypto.randomUUID()

  const newNode = {
    id: newNodeId,
    type: "call",
    position: { x: pos.x, y: pos.y },
    data: { nodeType: "call", type: "call" },
  }

  const newEdge = {
    id: `e-${sourceNodeId}-${newNodeId}-${Date.now()}`,
    source: sourceNodeId,
    target: newNodeId,
    sourceHandle: sourceHandle ?? undefined,
    type: "deleteable",
  }

  vfNodes.value = [...vfNodes.value, newNode]
  vfEdges.value = [...vfEdges.value, newEdge]
  selectedNodeId.value = newNodeId
  saveToDb()
}

// --- Delete edge ---
function handleDeleteEdge(edgeId: string) {
  vfEdges.value = vfEdges.value.filter((e) => e.id !== edgeId)
  saveToDb()
}

// --- Save to db ---
let saveTimeout: ReturnType<typeof setTimeout> | null = null

function cancelPendingSave() {
  if (saveTimeout) {
    clearTimeout(saveTimeout)
    saveTimeout = null
  }
}

function saveToDb() {
  cancelPendingSave()
  if (!flow.value || suppressAutoSave.value || restoringViewport.value) return
  const normalized = buildNormalizedStoredGraph()
  const meta: FlowMeta = {
    viewport: { x: viewport.value.x, y: viewport.value.y, zoom: viewport.value.zoom },
  }
  void updateFlowItem(flow.value.id, {
    kind: flowKind.value,
    nodes: normalized.nodes,
    edges: normalized.edges,
    valid: validationState.value.valid,
    validation_errors: validationState.value.errors,
    meta,
  })
}

provide("deleteEdge", handleDeleteEdge)
provide("flowKind", flowKind)
provide("graphNodes", vfNodes)
provide("graphEdges", vfEdges)
provide("projectFlows", flows)
provide("procedureCatalog", procedureCatalog)
provide("procedureCatalogLoading", procedureCatalogLoading)
provide("procedureCatalogError", procedureCatalogError)
provide("selectedNodeId", selectedNodeId)
provide("saveGraph", saveToDb)
</script>

<template>
  <div class="flex flex-1 overflow-hidden">
    <div class="flex-1">
      <VueFlow
        v-model:nodes="vfNodes"
        v-model:edges="vfEdges"
        :node-types="nodeTypes"
        :edge-types="edgeTypes"
        :default-viewport="{ zoom: 1, x: 0, y: 0 }"
        :snap-to-grid="true"
        :snap-grid="[16, 16]"
        fit-view-on-init
        class="flow-editor bg-default"
        @node-click="onNodeClick"
        @node-drag-start="onNodeDragStart"
        @pane-click="onPaneClick"
        @connect="onConnect"
        @connect-start="onConnectStart"
        @connect-end="onConnectEnd"
        @nodes-change="onNodesChange"
        @edges-change="onEdgesChange"
      >
        <Background :gap="16" :size="1" :color="'var(--vf-bg-dot)'" />
      </VueFlow>
    </div>

    <FlowNodeConfigPanel />
  </div>
</template>

<style>
@import "@vue-flow/core/dist/style.css";
@import "@vue-flow/core/dist/theme-default.css";
@import "@vue-flow/controls/dist/style.css";

.flow-editor {
  --vf-node-bg: transparent;
  --vf-node-text: var(--color-neutral-100);
  --vf-node-color: transparent;
  --vf-handle: var(--color-neutral-600);
  --vf-box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  --vf-bg-dot: rgba(0, 0, 0, 0.08);
}

.dark .flow-editor {
  --vf-bg-dot: rgba(255, 255, 255, 0.12);
}

.vue-flow__node-default,
.vue-flow__node-input,
.vue-flow__node-output {
  border: none !important;
  border-radius: 0.75rem !important;
}

.vue-flow__node-default:focus,
.vue-flow__node-default:focus-visible,
.vue-flow__node-input:focus,
.vue-flow__node-input:focus-visible,
.vue-flow__node-output:focus,
.vue-flow__node-output:focus-visible,
.vue-flow__node-default.selected,
.vue-flow__node-input.selected,
.vue-flow__node-output.selected {
  border: none !important;
  border-radius: 0.75rem !important;
  outline: none !important;
}

.vue-flow__edge-path {
  stroke: var(--color-neutral-500);
}

.vue-flow__controls {
  border-radius: 0.75rem;
  border: 1px solid rgba(0, 0, 0, 0.1);
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.dark .vue-flow__controls {
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(23, 23, 23, 0.8);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.vue-flow__controls-button {
  background: transparent;
  border-color: transparent;
  color: var(--color-neutral-700);
}

.dark .vue-flow__controls-button {
  color: var(--color-neutral-100);
}

.vue-flow__controls-button:hover {
  background: rgba(0, 0, 0, 0.05);
}

.dark .vue-flow__controls-button:hover {
  background: rgba(255, 255, 255, 0.1);
}

.vue-flow__node.selected {
  box-shadow: none !important;
}

.vue-flow__node.selected .flow-node {
  box-shadow:
    0 0 0 2px var(--color-primary-500),
    0 8px 32px rgba(0, 0, 0, 0.3) !important;
}

.vue-flow__node.node-dimmed {
  opacity: 0.3;
  filter: grayscale(0.8);
}

@keyframes pulse-progress {
  0%,
  100% {
    opacity: 0.3;
  }
  50% {
    opacity: 0.6;
  }
}

.pulse-progress {
  animation: pulse-progress 1.5s ease-in-out infinite;
}
</style>
