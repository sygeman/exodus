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
import { useCollectionQuery, useUpdateItem } from "@/hooks"
import { useFlowHighlighting } from "@/composables/useFlowHighlighting"
import FlowNode from "@/components/FlowNode.vue"
import DeletableEdge from "@/components/DeletableEdge.vue"
import FlowNodeConfigPanel from "@/components/FlowNodeConfigPanel.vue"
import {
  deriveTriggerFromNodes,
  getFlowKind,
  getTriggerNodeData,
  type FlowTrigger,
  type StoredFlowEdge,
  type StoredFlowNode,
  validateFlowGraph,
} from "@/types/flow"

const route = useRoute()
const projectId = computed(() => route.params.id as string)
const flowId = computed(() => route.params.flowId as string)
const [updateItem] = useUpdateItem()

const { data: flows } = useCollectionQuery("flows", () => ({
  filter: { project_id: { _eq: projectId.value } },
}))

type FlowItem = {
  id: string
  data: {
    name?: string
    kind?: unknown
    trigger?: FlowTrigger | null
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
  action: "action",
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
  action: "action",
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

const suppressAutoSave = ref(false)

watch(
  flow,
  (f) => {
    if (!f) return
    suppressAutoSave.value = true
    cancelPendingSave()
    const currentSelectedNodeId = selectedNodeId.value
    const nodes = (f.data.nodes ?? []) as StoredFlowNode[]
    const edges = (f.data.edges ?? []) as StoredFlowEdge[]
    vfNodes.value = nodes.map((n) => ({
      id: n.id,
      type: NODE_TYPE_MAP[n.type] || "action",
      position: n.position,
      data:
        n.type === "trigger"
          ? {
              ...n.data,
              ...getTriggerNodeData((f.data.trigger as FlowTrigger | null | undefined) ?? null),
              label: typeof n.data?.label === "string" ? n.data.label : "Trigger",
              nodeType: n.type,
            }
          : { ...n.data, nodeType: n.type },
    }))
    vfEdges.value = edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      label: e.label,
      type: "deleteable",
    }))

    const meta = (f.data.meta ?? {}) as FlowMeta
    selectedNodeId.value =
      currentSelectedNodeId && nodes.some((node) => node.id === currentSelectedNodeId)
        ? currentSelectedNodeId
        : null
    if (meta.viewport) {
      setViewport(meta.viewport)
    }
    suppressAutoSave.value = false
    applyHighlighting()
  },
  { immediate: true },
)

const FlowNodeRaw = markRaw(FlowNode)

const nodeTypes = {
  trigger: FlowNodeRaw,
  action: FlowNodeRaw,
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
  validateFlowGraph({
    kind: flowKind.value,
    nodes: vfNodes.value.map((node) => ({
      id: node.id,
      type:
        ((node.data as Record<string, unknown>)?.nodeType as string) ||
        REVERSE_TYPE_MAP[node.type] ||
        "action",
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
  }),
)

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
    type: "action",
    position: { x: pos.x, y: pos.y },
    data: { nodeType: "action" },
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
  if (!flow.value) return
  const nodesForStorage = vfNodes.value.map((n) => ({
    id: n.id,
    type:
      ((n.data as Record<string, unknown>)?.nodeType as string) ||
      REVERSE_TYPE_MAP[n.type] ||
      "action",
    position: n.position,
    data: n.data,
  })) as StoredFlowNode[]
  const edgesForStorage = vfEdges.value.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle,
    label: e.label,
  })) as StoredFlowEdge[]
  const nextTrigger = deriveTriggerFromNodes(
    flowKind.value,
    nodesForStorage,
    (flow.value.data.trigger as FlowTrigger | null | undefined) ?? null,
  )
  const meta: FlowMeta = {
    viewport: { x: viewport.value.x, y: viewport.value.y, zoom: viewport.value.zoom },
  }
  updateItem(flow.value.id, {
    kind: flowKind.value,
    trigger: nextTrigger,
    nodes: nodesForStorage,
    edges: edgesForStorage,
    valid: validationState.value.valid,
    validation_errors: validationState.value.errors,
    meta,
  })
}

provide("deleteEdge", handleDeleteEdge)
provide("flowKind", flowKind)
provide("graphNodes", vfNodes)
provide("graphEdges", vfEdges)
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
