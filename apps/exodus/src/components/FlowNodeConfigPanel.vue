<script setup lang="ts">
import { computed } from "vue"
import { useRoute } from "vue-router"
import { useT } from "@exodus/edem-vue"
import { useCollectionQuery, useUpdateItem } from "@/hooks"

type NodeData = {
  type?: string
  label?: string
  triggerType?: string
  module?: string
  proc?: string
  action?: string
  field?: string
  operator?: string
  value?: unknown
  seconds?: number
  code?: string
  expression?: string
  flow_id?: string
  [key: string]: unknown
}

type StoredNode = {
  id: string
  type: string
  position: { x: number; y: number }
  data: NodeData
}

type StoredEdge = {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  label?: string
}

interface FlowMeta {
  selectedNodeId?: string
}

const route = useRoute()
const [updateItem] = useUpdateItem()
const t = useT()

const flowId = computed(() => route.params.flowId as string)

const { data: flows } = useCollectionQuery("flows", () => ({
  filter: { project_id: { _eq: route.params.id as string } },
}))

const flow = computed(() => flows.value.find((f) => f.id === flowId.value))

const nodes = computed<StoredNode[]>(() => (flow.value?.data.nodes ?? []) as StoredNode[])
const edges = computed<StoredEdge[]>(() => (flow.value?.data.edges ?? []) as StoredEdge[])

const selectedNodeId = computed(() => {
  const meta = (flow.value?.data.meta ?? {}) as FlowMeta
  return meta.selectedNodeId ?? null
})

const node = computed(() => {
  if (!selectedNodeId.value) return null
  const found = nodes.value.find((n) => n.id === selectedNodeId.value)
  if (!found) return null
  return { id: found.id, type: found.type, data: found.data }
})

const isTriggerNode = computed(() => node.value?.type === "trigger")

function saveNode(updatedNodes: StoredNode[]) {
  if (!flow.value) return
  const meta: FlowMeta = {
    selectedNodeId: selectedNodeId.value ?? undefined,
  }
  updateItem(flow.value.id, { nodes: updatedNodes, meta })
}

function updateField(key: string, value: unknown) {
  if (!node.value) return
  const updatedNodes = nodes.value.map((n) => {
    if (n.id !== selectedNodeId.value) return n
    return { ...n, data: { ...n.data, [key]: value } }
  })
  saveNode(updatedNodes)
}

function closePanel() {
  if (!flow.value) return
  updateItem(flow.value.id, { meta: { selectedNodeId: undefined } })
}

function deleteNode() {
  if (!selectedNodeId.value || !flow.value || isTriggerNode.value) return
  const nodeId = selectedNodeId.value
  const updatedNodes = nodes.value.filter((n) => n.id !== nodeId)
  const updatedEdges = edges.value.filter((e) => e.source !== nodeId && e.target !== nodeId)
  updateItem(flow.value.id, {
    nodes: updatedNodes,
    edges: updatedEdges,
    meta: { selectedNodeId: undefined },
  })
}

function deleteEdge(edgeId: string) {
  if (!flow.value) return
  const updatedEdges = edges.value.filter((e) => e.id !== edgeId)
  updateItem(flow.value.id, { edges: updatedEdges })
}

const NODE_TYPE_OPTIONS = [
  { label: "Action", value: "action" },
  { label: "Condition", value: "condition" },
  { label: "Delay", value: "delay" },
  { label: "Fork", value: "fork" },
  { label: "Join", value: "join" },
  { label: "Loop", value: "loop" },
  { label: "Switch", value: "switch" },
  { label: "Transform", value: "transform" },
  { label: "Subflow", value: "subflow" },
  { label: "Input", value: "input" },
  { label: "Output", value: "output" },
]

const TRIGGER_TYPE_OPTIONS = [
  { label: "Manual", value: "manual" },
  { label: "Event", value: "event" },
  { label: "Schedule", value: "schedule" },
  { label: "Webhook", value: "webhook" },
]

const OPERATOR_OPTIONS = [
  { label: "= (equals)", value: "eq" },
  { label: "≠ (not equals)", value: "ne" },
  { label: "> (greater)", value: "gt" },
  { label: "< (less)", value: "lt" },
  { label: "≥ (gte)", value: "gte" },
  { label: "≤ (lte)", value: "lte" },
  { label: "contains", value: "contains" },
]

function changeNodeType(newType: string) {
  if (!node.value) return
  const updatedNodes = nodes.value.map((n) => {
    if (n.id !== selectedNodeId.value) return n
    return { ...n, type: newType, data: { ...n.data, type: newType } }
  })
  saveNode(updatedNodes)
}

const incomingEdges = computed(() => {
  if (!node.value) return []
  return edges.value.filter((e) => e.target === node.value!.id)
})

const outgoingEdges = computed(() => {
  if (!node.value) return []
  return edges.value.filter((e) => e.source === node.value!.id)
})

function getNodeLabel(nodeId: string): string {
  const n = nodes.value.find((nd) => nd.id === nodeId)
  return n?.data?.label || n?.data?.type || nodeId.slice(0, 8)
}
</script>

<template>
  <div class="border-default bg-default flex w-80 flex-col border-l">
    <div class="flex flex-1 flex-col overflow-hidden">
      <template v-if="node">
        <!-- Header -->
        <div class="border-default flex items-center justify-between border-b px-4 py-3">
          <span class="text-sm font-semibold">{{
            node.data.label || node.data.type || node.type
          }}</span>
          <UButton variant="ghost" size="xs" icon="i-lucide-x" @click="closePanel()" />
        </div>
        <div class="flex-1 overflow-y-auto p-4">
          <div class="flex flex-col gap-4">
            <!-- Node type selector -->
            <div class="flex flex-col gap-1.5">
              <label class="text-muted text-xs font-medium">{{
                t({ en: "Type", ru: "Тип" })
              }}</label>
              <USelect
                :model-value="node.data.type || node.type"
                :items="NODE_TYPE_OPTIONS"
                value-key="value"
                label-key="label"
                size="sm"
                @update:model-value="changeNodeType"
              />
            </div>

            <!-- Label -->
            <div class="flex flex-col gap-1.5">
              <label class="text-muted text-xs font-medium">{{
                t({ en: "Label", ru: "Метка" })
              }}</label>
              <UInput
                :model-value="node.data.label || ''"
                size="sm"
                :placeholder="node.data.type || node.type"
                @update:model-value="updateField('label', $event)"
              />
            </div>

            <!-- Trigger config -->
            <template v-if="node.data.type === 'trigger' || node.type === 'trigger'">
              <div class="flex flex-col gap-1.5">
                <label class="text-muted text-xs font-medium">{{
                  t({ en: "Trigger type", ru: "Тип триггера" })
                }}</label>
                <USelect
                  :model-value="node.data.triggerType || 'manual'"
                  :items="TRIGGER_TYPE_OPTIONS"
                  value-key="value"
                  label-key="label"
                  size="sm"
                  @update:model-value="updateField('triggerType', $event)"
                />
              </div>
              <div v-if="node.data.triggerType === 'schedule'" class="flex flex-col gap-1.5">
                <label class="text-muted text-xs font-medium">{{
                  t({ en: "Interval", ru: "Интервал" })
                }}</label>
                <UInput
                  :model-value="
                    ((node.data.config as Record<string, unknown>)?.every as string) || ''
                  "
                  size="sm"
                  placeholder="15m"
                  @update:model-value="
                    updateField('config', { ...(node.data.config as object), every: $event })
                  "
                />
              </div>
              <div v-if="node.data.triggerType === 'event'" class="flex flex-col gap-1.5">
                <label class="text-muted text-xs font-medium">{{
                  t({ en: "Event name", ru: "Имя события" })
                }}</label>
                <UInput
                  :model-value="
                    ((node.data.config as Record<string, unknown>)?.event as string) || ''
                  "
                  size="sm"
                  placeholder="item.created"
                  @update:model-value="
                    updateField('config', { ...(node.data.config as object), event: $event })
                  "
                />
              </div>
            </template>

            <!-- Action config -->
            <template v-if="node.data.type === 'action' || node.type === 'action'">
              <div class="flex flex-col gap-1.5">
                <label class="text-muted text-xs font-medium">Module</label>
                <UInput
                  :model-value="node.data.module || ''"
                  size="sm"
                  placeholder="data"
                  @update:model-value="updateField('module', $event)"
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-muted text-xs font-medium">Proc</label>
                <UInput
                  :model-value="node.data.proc || node.data.action || ''"
                  size="sm"
                  placeholder="createItem"
                  @update:model-value="updateField('proc', $event)"
                />
              </div>
            </template>

            <!-- Condition config -->
            <template v-if="node.data.type === 'condition' || node.type === 'condition'">
              <div class="flex flex-col gap-1.5">
                <label class="text-muted text-xs font-medium">Field</label>
                <UInput
                  :model-value="node.data.field || ''"
                  size="sm"
                  placeholder="status"
                  @update:model-value="updateField('field', $event)"
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-muted text-xs font-medium">{{
                  t({ en: "Operator", ru: "Оператор" })
                }}</label>
                <USelect
                  :model-value="node.data.operator || 'eq'"
                  :items="OPERATOR_OPTIONS"
                  value-key="value"
                  label-key="label"
                  size="sm"
                  @update:model-value="updateField('operator', $event)"
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-muted text-xs font-medium">{{
                  t({ en: "Value", ru: "Значение" })
                }}</label>
                <UInput
                  :model-value="String(node.data.value ?? '')"
                  size="sm"
                  @update:model-value="updateField('value', $event)"
                />
              </div>
            </template>

            <!-- Delay config -->
            <template v-if="node.data.type === 'delay' || node.type === 'delay'">
              <div class="flex flex-col gap-1.5">
                <label class="text-muted text-xs font-medium">{{
                  t({ en: "Seconds", ru: "Секунды" })
                }}</label>
                <UInput
                  :model-value="String(node.data.seconds ?? 5)"
                  type="number"
                  size="sm"
                  @update:model-value="updateField('seconds', Number($event))"
                />
              </div>
            </template>

            <!-- Expression -->
            <template v-if="node.data.type === 'condition' || node.type === 'condition'">
              <div class="flex flex-col gap-1.5">
                <label class="text-muted text-xs font-medium">{{
                  t({ en: "Expression", ru: "Выражение" })
                }}</label>
                <UInput
                  :model-value="node.data.expression || ''"
                  size="sm"
                  placeholder="item.status === 'active'"
                  @update:model-value="updateField('expression', $event)"
                />
              </div>
            </template>

            <!-- Switch config -->
            <template v-if="node.data.type === 'switch' || node.type === 'switch'">
              <div class="flex flex-col gap-1.5">
                <label class="text-muted text-xs font-medium">{{
                  t({ en: "Value expression", ru: "Выражение значения" })
                }}</label>
                <UInput
                  :model-value="(node.data.value as string) || ''"
                  size="sm"
                  placeholder="item.type"
                  @update:model-value="updateField('value', $event)"
                />
              </div>
            </template>

            <!-- Loop config -->
            <template v-if="node.data.type === 'loop' || node.type === 'loop'">
              <div class="flex flex-col gap-1.5">
                <label class="text-muted text-xs font-medium">{{
                  t({ en: "Source", ru: "Источник" })
                }}</label>
                <UInput
                  :model-value="(node.data.source as string) || ''"
                  size="sm"
                  placeholder="items"
                  @update:model-value="updateField('source', $event)"
                />
              </div>
            </template>

            <!-- Transform config -->
            <template v-if="node.data.type === 'transform' || node.type === 'transform'">
              <div class="flex flex-col gap-1.5">
                <label class="text-muted text-xs font-medium">{{
                  t({ en: "Code", ru: "Код" })
                }}</label>
                <UInput
                  :model-value="node.data.code || ''"
                  size="sm"
                  placeholder="return input"
                  @update:model-value="updateField('code', $event)"
                />
              </div>
            </template>

            <!-- Subflow config -->
            <template v-if="node.data.type === 'subflow' || node.type === 'subflow'">
              <div class="flex flex-col gap-1.5">
                <label class="text-muted text-xs font-medium">{{
                  t({ en: "Flow ID", ru: "ID потока" })
                }}</label>
                <UInput
                  :model-value="node.data.flow_id || ''"
                  size="sm"
                  @update:model-value="updateField('flow_id', $event)"
                />
              </div>
            </template>

            <!-- Connections -->
            <div
              v-if="incomingEdges.length > 0 || outgoingEdges.length > 0"
              class="flex flex-col gap-2"
            >
              <label class="text-muted text-xs font-medium">{{
                t({ en: "Connections", ru: "Связи" })
              }}</label>
              <div
                v-for="edge in incomingEdges"
                :key="edge.id"
                class="flex items-center gap-2 text-xs"
              >
                <span class="text-muted">←</span>
                <span class="flex-1 truncate">{{ getNodeLabel(edge.source) }}</span>
                <UButton
                  variant="ghost"
                  color="error"
                  size="xs"
                  icon="i-lucide-x"
                  class="opacity-0 group-hover:opacity-100"
                  @click="deleteEdge(edge.id)"
                />
              </div>
              <div
                v-for="edge in outgoingEdges"
                :key="edge.id"
                class="flex items-center gap-2 text-xs"
              >
                <span class="text-muted">→</span>
                <span class="flex-1 truncate">{{ getNodeLabel(edge.target) }}</span>
                <UButton
                  variant="ghost"
                  color="error"
                  size="xs"
                  icon="i-lucide-x"
                  class="opacity-0 group-hover:opacity-100"
                  @click="deleteEdge(edge.id)"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="border-default border-t p-4">
          <UButton
            v-if="!isTriggerNode"
            color="error"
            variant="outline"
            size="sm"
            class="w-full justify-center"
            icon="i-lucide-trash-2"
            @click="deleteNode()"
          >
            {{ t({ en: "Delete node", ru: "Удалить ноду" }) }}
          </UButton>
          <div v-else class="flex items-center justify-center gap-1.5">
            <UIcon name="i-lucide-lock" class="text-muted h-3.5 w-3.5" />
            <p class="text-muted text-center text-xs">
              {{ t({ en: "Cannot delete the initial node", ru: "Нельзя удалить начальную ноду" }) }}
            </p>
          </div>
        </div>
      </template>

      <!-- Empty state -->
      <div v-else class="flex flex-1 items-center justify-center p-6">
        <p class="text-muted text-center text-sm">
          {{ t({ en: "Select a node to edit", ru: "Выберите ноду для редактирования" }) }}
        </p>
      </div>
    </div>
  </div>
</template>
