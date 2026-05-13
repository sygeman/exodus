<script setup lang="ts">
import { ref, computed, watch, provide } from "vue"
import { useRoute, useRouter } from "vue-router"
import { VueFlow, useVueFlow, type Connection } from "@vue-flow/core"
import { Background } from "@vue-flow/background"
import { useCollectionQuery, useUpdateItem } from "@/hooks"
import TriggerNode from "@/components/flow/nodes/TriggerNode.vue"
import ActionNode from "@/components/flow/nodes/ActionNode.vue"
import ConditionNode from "@/components/flow/nodes/ConditionNode.vue"
import SwitchNode from "@/components/flow/nodes/SwitchNode.vue"
import LoopNode from "@/components/flow/nodes/LoopNode.vue"
import DelayNode from "@/components/flow/nodes/DelayNode.vue"
import TransformNode from "@/components/flow/nodes/TransformNode.vue"
import ForkNode from "@/components/flow/nodes/ForkNode.vue"
import JoinNode from "@/components/flow/nodes/JoinNode.vue"
import SubFlowNode from "@/components/flow/nodes/SubFlowNode.vue"
import InputNode from "@/components/flow/nodes/InputNode.vue"
import OutputNode from "@/components/flow/nodes/OutputNode.vue"
import DeleteableEdge from "@/components/flow/edges/DeleteableEdge.vue"
import NodeConfigPanel from "@/components/flow/NodeConfigPanel.vue"

const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.params.id as string)
const flowId = computed(() => route.params.flowId as string)
const [updateItem] = useUpdateItem()

const { data: flows } = useCollectionQuery("flows", () => ({
  filter: { project_id: { _eq: projectId.value } },
}))

const flow = computed(() => flows.value.find((f) => f.id === flowId.value))

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
  }>
>([])

watch(
  flow,
  (f) => {
    if (!f) return
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
  },
  { immediate: true },
)

const nodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  condition: ConditionNode,
  switch: SwitchNode,
  loop: LoopNode,
  delay: DelayNode,
  transform: TransformNode,
  fork: ForkNode,
  join: JoinNode,
  subflow: SubFlowNode,
  input: InputNode,
  output: OutputNode,
}

const edgeTypes = {
  deleteable: DeleteableEdge,
}

const {
  onConnectStart,
  onConnectEnd,
  onConnect: vueFlowOnConnect,
  onNodeClick,
  onPaneClick,
  onNodesChange,
  onEdgesChange,
} = useVueFlow()

const selectedNodeId = ref<string | null>(null)

const selectedNode = computed(() => {
  if (!selectedNodeId.value) return null
  const node = vfNodes.value.find((n) => n.id === selectedNodeId.value)
  if (!node) return null
  return {
    id: node.id,
    type: node.type,
    data: node.data as Record<string, unknown>,
  }
})

// --- Connect start/end: drag handle to empty space -> create node ---
const connectingFrom = ref<{ nodeId: string; handleId: string | null } | null>(null)

onConnectStart((params) => {
  if (params.nodeId) {
    connectingFrom.value = {
      nodeId: params.nodeId,
      handleId: params.handleId ?? null,
    }
  }
})

onConnectEnd((event?: MouseEvent | TouchEvent) => {
  if (!connectingFrom.value || !event) return
  const target = event.target as HTMLElement
  const isOnNode = target.closest(".vue-flow__node")
  const isOnHandle = target.closest(".vue-flow__handle")
  if (!isOnNode && !isOnHandle) {
    handleAddNodeFromEdge(connectingFrom.value.nodeId, connectingFrom.value.handleId)
  }
  connectingFrom.value = null
})

// --- Connect two existing nodes ---
vueFlowOnConnect((connection: Connection) => {
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
})

// --- Node selection ---
onNodeClick(({ node }) => {
  selectedNodeId.value = node.id
})

onPaneClick(() => {
  selectedNodeId.value = null
})

// --- Node drag -> save positions ---
onNodesChange((changes) => {
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
})

// --- Edge removal (delete key / programmatic) ---
onEdgesChange((changes) => {
  for (const change of changes) {
    if (change.type === "remove") {
      vfEdges.value = vfEdges.value.filter((e) => e.id !== change.id)
      saveToDb()
    }
  }
})

// --- Add node from edge drag ---
function handleAddNodeFromEdge(sourceNodeId: string, _sourceHandle: string | null) {
  const sourceNode = vfNodes.value.find((n) => n.id === sourceNodeId)
  const newX = sourceNode?.position.x ?? 250
  const newY = (sourceNode?.position.y ?? 0) + 120
  const newNodeId = crypto.randomUUID()

  const newNode = {
    id: newNodeId,
    type: "action",
    position: { x: newX, y: newY },
    data: { nodeType: "action" },
  }

  const newEdge = {
    id: `e-${sourceNodeId}-${newNodeId}-${Date.now()}`,
    source: sourceNodeId,
    target: newNodeId,
    type: "deleteable",
  }

  vfNodes.value = [...vfNodes.value, newNode]
  vfEdges.value = [...vfEdges.value, newEdge]
  selectedNodeId.value = newNodeId
  saveToDb()
}

// --- Delete node ---
function handleDeleteNode() {
  if (!selectedNodeId.value) return
  const nodeId = selectedNodeId.value
  vfNodes.value = vfNodes.value.filter((n) => n.id !== nodeId)
  vfEdges.value = vfEdges.value.filter((e) => e.source !== nodeId && e.target !== nodeId)
  selectedNodeId.value = null
  saveToDb()
}

// --- Delete edge ---
function handleDeleteEdge(edgeId: string) {
  vfEdges.value = vfEdges.value.filter((e) => e.id !== edgeId)
  saveToDb()
}

// --- Update node from config panel ---
function handleUpdateNode(updates: Record<string, unknown>) {
  if (!selectedNodeId.value) return
  const nodeIdx = vfNodes.value.findIndex((n) => n.id === selectedNodeId.value)
  if (nodeIdx === -1) return
  const node = vfNodes.value[nodeIdx]
  const newData = { ...node.data, ...(updates.data as Record<string, unknown>) }
  const newType = updates.type as string | undefined
  if (newType) newData.nodeType = newType
  vfNodes.value = vfNodes.value.map((n, i) => {
    if (i !== nodeIdx) return n
    return {
      ...n,
      type: newType || n.type,
      data: newData,
    }
  })
  saveToDb()
}

// --- Save to db (debounced) ---
let saveTimeout: ReturnType<typeof setTimeout> | null = null
function saveToDb() {
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(async () => {
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
    await updateItem(flow.value.id, { nodes: nodesForStorage, edges: edgesForStorage })
  }, 500)
}

function getNodeCount(): number {
  return vfNodes.value.length
}

function getEdgeCount(): number {
  return vfEdges.value.length
}

provide("deleteEdge", handleDeleteEdge)
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Header -->
    <header class="border-default flex h-12 shrink-0 items-center justify-between border-b px-4">
      <div class="flex items-center gap-3">
        <UButton
          variant="ghost"
          size="xs"
          icon="i-lucide-arrow-left"
          @click="router.push(`/project/${projectId}/flows`)"
        />
        <span v-if="flow" class="font-semibold">{{ flow.data.name }}</span>
        <span
          v-if="flow"
          class="inline-flex h-5 items-center rounded px-1.5 text-xs"
          :class="{
            'bg-gray-500/10 text-gray-500': flow.data.status === 'draft',
            'bg-green-500/10 text-green-500': flow.data.status === 'active',
            'bg-yellow-500/10 text-yellow-500': flow.data.status === 'paused',
          }"
        >
          {{ flow.data.status }}
        </span>
      </div>
      <div class="text-muted flex items-center gap-4 text-xs">
        <span>{{ getNodeCount() }} nodes</span>
        <span>{{ getEdgeCount() }} edges</span>
      </div>
    </header>

    <!-- Canvas + sidebar -->
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
        >
          <Background :gap="16" :size="1" />
        </VueFlow>
      </div>

      <!-- Side panel -->
      <NodeConfigPanel
        :node="selectedNode"
        :all-nodes="vfNodes"
        :all-edges="vfEdges"
        @update="handleUpdateNode"
        @delete="handleDeleteNode"
        @delete-edge="handleDeleteEdge"
        @close="selectedNodeId = null"
      />
    </div>
  </div>
</template>

<style>
@import "@vue-flow/core/dist/style.css";
@import "@vue-flow/core/dist/theme-default.css";
@import "@vue-flow/controls/dist/style.css";

.flow-editor {
  --vf-node-bg: var(--color-neutral-900);
  --vf-node-text: var(--color-neutral-100);
  --vf-node-color: var(--color-neutral-700);
  --vf-handle: var(--color-neutral-600);
  --vf-box-shadow: none;
}

.vue-flow__edge-path {
  stroke: var(--color-neutral-500);
}

.vue-flow__background pattern line {
  stroke: var(--color-neutral-800);
}

.vue-flow__controls {
  border-radius: 0.5rem;
  border: 1px solid var(--color-neutral-700);
  background: var(--color-neutral-900);
}

.vue-flow__controls-button {
  background: var(--color-neutral-900);
  border-color: var(--color-neutral-700);
  color: var(--color-neutral-100);
}

.vue-flow__controls-button:hover {
  background: var(--color-neutral-800);
}

.vue-flow__node.selected,
.vue-flow__node-input,
.vue-flow__node-output {
  box-shadow: none !important;
  border: none !important;
  background: transparent !important;
  outline: none !important;
}
</style>
