<script setup lang="ts">
import { ref, computed, watch } from "vue"
import { useDebounceFn } from "@vueuse/core"
import { useT } from "@exodus/edem-vue"

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

type FlowEdge = {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
}

const props = defineProps<{
  node: { id: string; type: string; data: NodeData } | null
  allNodes: Array<{ id: string; type: string; data: NodeData }>
  allEdges: FlowEdge[]
}>()

const emit = defineEmits<{
  update: [updates: Record<string, unknown>]
  delete: []
  deleteEdge: [edgeId: string]
  close: []
}>()

const t = useT()

const localData = ref<NodeData>({})

watch(
  () => props.node,
  (n) => {
    if (n) localData.value = { ...n.data }
  },
  { immediate: true },
)

const debouncedUpdate = useDebounceFn(() => {
  emit("update", { data: { ...localData.value } })
}, 500)

function updateField(key: string, value: unknown) {
  localData.value[key] = value
  debouncedUpdate()
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

const VUE_FLOW_TYPE_MAP: Record<string, string> = {
  action: "action",
  condition: "condition",
  delay: "action",
  fork: "flow-control",
  join: "flow-control",
  loop: "flow-control",
  switch: "condition",
  transform: "action",
  subflow: "io",
  input: "io",
  output: "io",
}

function changeNodeType(newType: string) {
  const vueFlowType = VUE_FLOW_TYPE_MAP[newType] || "action"
  localData.value.type = newType
  emit("update", {
    type: vueFlowType,
    data: { ...localData.value, type: newType },
  })
}

const incomingEdges = computed(() => {
  if (!props.node) return []
  return props.allEdges.filter((e) => e.target === props.node!.id)
})

const outgoingEdges = computed(() => {
  if (!props.node) return []
  return props.allEdges.filter((e) => e.source === props.node!.id)
})

function getNodeLabel(nodeId: string): string {
  const node = props.allNodes.find((n) => n.id === nodeId)
  return node?.data?.label || node?.data?.type || nodeId.slice(0, 8)
}

const isSystemNode = computed(() => {
  const nodeType = props.node?.data?.type || props.node?.type
  return nodeType === "trigger" || nodeType === "input" || nodeType === "output"
})
</script>

<template>
  <div v-if="node" class="border-default bg-default flex w-80 flex-col border-l">
    <!-- Header -->
    <div class="border-default flex items-center justify-between border-b px-4 py-3">
      <span class="text-sm font-semibold">{{
        localData.label || localData.type || node.type
      }}</span>
      <UButton variant="ghost" size="xs" icon="i-lucide-x" @click="emit('close')" />
    </div>

    <!-- Scrollable content -->
    <div class="flex-1 overflow-y-auto p-4">
      <div class="flex flex-col gap-4">
        <!-- Node type selector -->
        <div v-if="!isSystemNode" class="flex flex-col gap-1.5">
          <label class="text-muted text-xs font-medium">{{ t({ en: "Type", ru: "Тип" }) }}</label>
          <USelect
            :model-value="localData.type || node.type"
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
            :model-value="localData.label || ''"
            size="sm"
            :placeholder="localData.type || node.type"
            @update:model-value="updateField('label', $event)"
          />
        </div>

        <!-- Trigger config -->
        <template v-if="localData.type === 'trigger' || node.type === 'trigger'">
          <div class="flex flex-col gap-1.5">
            <label class="text-muted text-xs font-medium">{{
              t({ en: "Trigger type", ru: "Тип триггера" })
            }}</label>
            <USelect
              :model-value="localData.triggerType || 'manual'"
              :items="TRIGGER_TYPE_OPTIONS"
              value-key="value"
              label-key="label"
              size="sm"
              @update:model-value="updateField('triggerType', $event)"
            />
          </div>
          <div v-if="localData.triggerType === 'schedule'" class="flex flex-col gap-1.5">
            <label class="text-muted text-xs font-medium">{{
              t({ en: "Interval", ru: "Интервал" })
            }}</label>
            <UInput
              :model-value="((localData.config as Record<string, unknown>)?.every as string) || ''"
              size="sm"
              placeholder="15m"
              @update:model-value="
                updateField('config', { ...(localData.config as object), every: $event })
              "
            />
          </div>
          <div v-if="localData.triggerType === 'event'" class="flex flex-col gap-1.5">
            <label class="text-muted text-xs font-medium">{{
              t({ en: "Event name", ru: "Имя события" })
            }}</label>
            <UInput
              :model-value="((localData.config as Record<string, unknown>)?.event as string) || ''"
              size="sm"
              placeholder="item.created"
              @update:model-value="
                updateField('config', { ...(localData.config as object), event: $event })
              "
            />
          </div>
        </template>

        <!-- Action config -->
        <template v-if="localData.type === 'action' || node.type === 'action'">
          <div class="flex flex-col gap-1.5">
            <label class="text-muted text-xs font-medium">Module</label>
            <UInput
              :model-value="localData.module || ''"
              size="sm"
              placeholder="data"
              @update:model-value="updateField('module', $event)"
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-muted text-xs font-medium">Proc</label>
            <UInput
              :model-value="localData.proc || localData.action || ''"
              size="sm"
              placeholder="createItem"
              @update:model-value="updateField('proc', $event)"
            />
          </div>
        </template>

        <!-- Condition config -->
        <template v-if="localData.type === 'condition' || node.type === 'condition'">
          <div class="flex flex-col gap-1.5">
            <label class="text-muted text-xs font-medium">Field</label>
            <UInput
              :model-value="localData.field || ''"
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
              :model-value="localData.operator || 'eq'"
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
              :model-value="String(localData.value ?? '')"
              size="sm"
              @update:model-value="updateField('value', $event)"
            />
          </div>
        </template>

        <!-- Delay config -->
        <template v-if="localData.type === 'delay' || node.type === 'delay'">
          <div class="flex flex-col gap-1.5">
            <label class="text-muted text-xs font-medium">{{
              t({ en: "Seconds", ru: "Секунды" })
            }}</label>
            <UInput
              :model-value="String(localData.seconds ?? 5)"
              type="number"
              size="sm"
              @update:model-value="updateField('seconds', Number($event))"
            />
          </div>
        </template>

        <!-- Condition -->
        <template v-if="localData.type === 'condition' || node.type === 'condition'">
          <div class="flex flex-col gap-1.5">
            <label class="text-muted text-xs font-medium">{{
              t({ en: "Expression", ru: "Выражение" })
            }}</label>
            <UInput
              :model-value="localData.expression || ''"
              size="sm"
              placeholder="item.status === 'active'"
              @update:model-value="updateField('expression', $event)"
            />
          </div>
        </template>

        <!-- Switch config -->
        <template v-if="localData.type === 'switch' || node.type === 'switch'">
          <div class="flex flex-col gap-1.5">
            <label class="text-muted text-xs font-medium">{{
              t({ en: "Value expression", ru: "Выражение значения" })
            }}</label>
            <UInput
              :model-value="(localData.value as string) || ''"
              size="sm"
              placeholder="item.type"
              @update:model-value="updateField('value', $event)"
            />
          </div>
        </template>

        <!-- Loop config -->
        <template v-if="localData.type === 'loop' || node.type === 'loop'">
          <div class="flex flex-col gap-1.5">
            <label class="text-muted text-xs font-medium">{{
              t({ en: "Source", ru: "Источник" })
            }}</label>
            <UInput
              :model-value="(localData.source as string) || ''"
              size="sm"
              placeholder="items"
              @update:model-value="updateField('source', $event)"
            />
          </div>
        </template>

        <!-- Transform config -->
        <template v-if="localData.type === 'transform' || node.type === 'transform'">
          <div class="flex flex-col gap-1.5">
            <label class="text-muted text-xs font-medium">{{ t({ en: "Code", ru: "Код" }) }}</label>
            <UInput
              :model-value="localData.code || ''"
              size="sm"
              placeholder="return input"
              @update:model-value="updateField('code', $event)"
            />
          </div>
        </template>

        <!-- Subflow config -->
        <template v-if="localData.type === 'subflow' || node.type === 'subflow'">
          <div class="flex flex-col gap-1.5">
            <label class="text-muted text-xs font-medium">{{
              t({ en: "Flow ID", ru: "ID потока" })
            }}</label>
            <UInput
              :model-value="localData.flow_id || ''"
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
          <div v-for="edge in incomingEdges" :key="edge.id" class="flex items-center gap-2 text-xs">
            <span class="text-muted">←</span>
            <span class="flex-1 truncate">{{ getNodeLabel(edge.source) }}</span>
            <UButton
              variant="ghost"
              color="error"
              size="xs"
              icon="i-lucide-x"
              class="opacity-0 group-hover:opacity-100"
              @click="emit('deleteEdge', edge.id)"
            />
          </div>
          <div v-for="edge in outgoingEdges" :key="edge.id" class="flex items-center gap-2 text-xs">
            <span class="text-muted">→</span>
            <span class="flex-1 truncate">{{ getNodeLabel(edge.target) }}</span>
            <UButton
              variant="ghost"
              color="error"
              size="xs"
              icon="i-lucide-x"
              class="opacity-0 group-hover:opacity-100"
              @click="emit('deleteEdge', edge.id)"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div v-if="!isSystemNode" class="border-default border-t p-4">
      <UButton color="error" variant="outline" size="sm" class="w-full" @click="emit('delete')">
        {{ t({ en: "Delete node", ru: "Удалить ноду" }) }}
      </UButton>
    </div>
  </div>
</template>
