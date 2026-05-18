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
import { useFlows, useUpdateItem } from "@/hooks"
import { useFlowHighlighting } from "@/composables/useFlowHighlighting"
import FlowNode from "@/components/FlowNode.vue"
import DeleteableEdge from "@/components/DeleteableEdge.vue"
import NodeConfigPanel from "@/components/NodeConfigPanel.vue"

const route = useRoute()
const projectId = computed(() => route.params.id as string)
const flowId = computed(() => route.params.flowId as string)
const [updateItem] = useUpdateItem()

const { items: flows } = useFlows({ filter: { project_id: { _eq: projectId.value } } })
const flow = computed(() => flows.value.find((f) => f.id === flowId.value))

const { viewport, setViewport, onMoveEnd, screenToFlowCoordinate } = useVueFlow()

interface FlowNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: Record<string, unknown>
}
interface FlowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  label?: string
}
interface FlowMeta {
  viewport?: { x: number; y: number; zoom: number }
  selectedNodeId?: string
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

const vfNodes = ref<
  Array<{
    id: string
    type: string
    position: { x: number; y: number }
    data: Record<string, unknown>
    class?: string
  }>
>([])
const vfEdges = ref<
  Array<{
    id: string
    source: string
    target: string
    sourceHandle?: string
    targetHandle?: string
    label?: string
    type?: string
    style?: { stroke: string }
    animated?: boolean
  }>
>([])

watch(
  flow,
  (f) => {
    if (!f) return
    cancelPendingSave()
    const nodes = (f.data.nodes ?? []) as FlowNode[]
    const edges = (f.data.edges ?? []) as FlowEdge[]
    vfNodes.value = nodes.map((n) => ({
      id: n.id,
      type: NODE_TYPE_MAP[n.type] || "action",
      position: n.position,
      data: { ...n.data, nodeType: n.type },
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
    if (meta.selectedNodeId) selectedNodeId.value = meta.selectedNodeId
    if (meta.viewport) setViewport(meta.viewport)
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
const edgeTypes = { deleteable: markRaw(DeleteableEdge) }

const selectedNodeId = ref<string | null>(null)
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
    if (hasSelection && !highlighted.has(node.id)) classes.push("node-dimmed")
    node.class = classes.join(" ") || undefined
  }
  applyEdgeHighlighting()
}

watch(selectedNodeId, () => {
  applyHighlighting()
  saveToDb()
})

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

const connectingFrom = ref<{ nodeId: string; handleId: string | null } | null>(null)

function onConnectStart(params: { nodeId?: string; handleId?: string | null }) {
  if (params.nodeId)
    connectingFrom.value = { nodeId: params.nodeId, handleId: params.handleId ?? null }
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

function onConnect(connection: Connection) {
  if (!connection.source || !connection.target || connection.source === connection.target) return
  const exists = vfEdges.value.some(
    (e) =>
      e.source === connection.source &&
      e.target === connection.target &&
      e.sourceHandle === connection.sourceHandle,
  )
  if (exists) return
  vfEdges.value = [
    ...vfEdges.value,
    {
      id: `e-${connection.source}-${connection.target}-${Date.now()}`,
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle ?? undefined,
      targetHandle: connection.targetHandle ?? undefined,
      type: "deleteable",
    },
  ]
  saveToDb()
}

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

function onEdgesChange(changes: EdgeChange[]) {
  for (const change of changes) {
    if (change.type === "remove") {
      vfEdges.value = vfEdges.value.filter((e) => e.id !== change.id)
      saveToDb()
    }
  }
}

function handleAddNodeFromEdge(
  sourceNodeId: string,
  sourceHandle: string | null,
  mousePosition?: { x: number; y: number },
) {
  const sourceNode = vfNodes.value.find((n) => n.id === sourceNodeId)
  const pos = mousePosition
    ? screenToFlowCoordinate(mousePosition)
    : { x: sourceNode?.position.x ?? 250, y: (sourceNode?.position.y ?? 0) + 120 }
  const newNodeId = crypto.randomUUID()
  vfNodes.value = [
    ...vfNodes.value,
    {
      id: newNodeId,
      type: "action",
      position: { x: pos.x, y: pos.y },
      data: { nodeType: "action" },
    },
  ]
  vfEdges.value = [
    ...vfEdges.value,
    {
      id: `e-${sourceNodeId}-${newNodeId}-${Date.now()}`,
      source: sourceNodeId,
      target: newNodeId,
      sourceHandle: sourceHandle ?? undefined,
      type: "deleteable",
    },
  ]
  selectedNodeId.value = newNodeId
  saveToDb()
}

function handleDeleteEdge(edgeId: string) {
  vfEdges.value = vfEdges.value.filter((e) => e.id !== edgeId)
  saveToDb()
}

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
  }))
  const edgesForStorage = vfEdges.value.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle,
    label: e.label,
  }))
  const meta: FlowMeta = {
    viewport: { x: viewport.value.x, y: viewport.value.y, zoom: viewport.value.zoom },
    selectedNodeId: selectedNodeId.value ?? undefined,
  }
  updateItem(flow.value.id, { nodes: nodesForStorage, edges: edgesForStorage, meta })
}

provide("deleteEdge", handleDeleteEdge)
</script>

<template>
  <div class="flex flex-1 overflow-hidden">
    <div class="flex-1">
      <VueFlow
        :nodes="vfNodes"
        :edges="vfEdges"
        :default-viewport="{ zoom: 1, x: 0, y: 0 }"
        snap-to-grid
        :snap-grid="[16, 16]"
        fit-view-init
        class="flow-editor bg-default"
      />
    </div>
    <NodeConfigPanel />
  </div>
</template>
