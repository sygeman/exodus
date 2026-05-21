<script setup lang="ts">
import { computed, inject, type ComputedRef, type Ref } from "vue"
import { useT } from "@exodus/edem-vue"
import { buildNodeContract } from "@/flow-node-contract"
import FlowContractFieldList from "@/components/FlowContractFieldList.vue"
import {
  listCallableModuleOptions,
  listCallableProcedureOptions,
  listSubscriptionProcedureOptions,
  type ProcedureCatalogModule,
  type SelectOption,
} from "@/procedure-catalog"
import {
  DEFAULT_FLOW_TRIGGER,
  getAllowedNodeTypes,
  getTriggerNodeData,
  getTriggerSourceFromNodeData,
  isProtectedNode,
  type FlowKind,
  type FlowTrigger,
  type ScheduleDay,
} from "@/types/flow"

type NodeData = {
  type?: string
  label?: string
  module?: string
  procedure?: string
  field?: string
  operator?: string
  value?: unknown
  seconds?: number
  code?: string
  expression?: string
  flow_id?: string
  [key: string]: unknown
}

type GraphNode = {
  id: string
  type: string
  position: { x: number; y: number }
  data: NodeData
  class?: string
}

type GraphEdge = {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  label?: string
}

type ProjectFlowItem = {
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

const t = useT()

const injectedFlowKindRef = inject<ComputedRef<FlowKind>>("flowKind")
const injectedGraphNodesRef = inject<Ref<GraphNode[]>>("graphNodes")
const injectedGraphEdgesRef = inject<Ref<GraphEdge[]>>("graphEdges")
const injectedProjectFlowsRef = inject<Ref<ProjectFlowItem[]>>("projectFlows")
const injectedProcedureCatalogRef = inject<Ref<ProcedureCatalogModule[]>>("procedureCatalog")
const injectedProcedureCatalogLoadingRef = inject<Ref<boolean>>("procedureCatalogLoading")
const injectedProcedureCatalogErrorRef = inject<Ref<string | null>>("procedureCatalogError")
const injectedSelectedNodeIdRef = inject<Ref<string | null>>("selectedNodeId")
const injectedSaveGraph = inject<() => void>("saveGraph")

if (
  !injectedFlowKindRef ||
  !injectedGraphNodesRef ||
  !injectedGraphEdgesRef ||
  !injectedProjectFlowsRef ||
  !injectedProcedureCatalogRef ||
  !injectedProcedureCatalogLoadingRef ||
  !injectedProcedureCatalogErrorRef ||
  !injectedSelectedNodeIdRef ||
  !injectedSaveGraph
) {
  throw new Error("FlowNodeConfigPanel requires graph context")
}

const flowKind = injectedFlowKindRef
const graphNodesRef = injectedGraphNodesRef
const graphEdgesRef = injectedGraphEdgesRef
const projectFlows = injectedProjectFlowsRef
const procedureCatalog = injectedProcedureCatalogRef
const procedureCatalogLoading = injectedProcedureCatalogLoadingRef
const procedureCatalogError = injectedProcedureCatalogErrorRef
const selectedNodeId = injectedSelectedNodeIdRef
const saveGraph = injectedSaveGraph

const nodes = computed<GraphNode[]>(() => graphNodesRef.value)
const edges = computed<GraphEdge[]>(() => graphEdgesRef.value)

const node = computed(() => {
  if (!selectedNodeId.value) return null
  const found = nodes.value.find((n) => n.id === selectedNodeId.value)
  if (!found) return null
  return { id: found.id, type: found.type, data: found.data }
})

const isProtectedSelectedNode = computed(() =>
  node.value ? isProtectedNode(flowKind.value, node.value) : false,
)

function updateField(key: string, value: unknown) {
  if (!node.value) return
  const updatedNodes = nodes.value.map((n) => {
    if (n.id !== selectedNodeId.value) return n
    return { ...n, data: { ...n.data, [key]: value } }
  })
  graphNodesRef.value = updatedNodes
  saveGraph()
}

function closePanel() {
  selectedNodeId.value = null
}

function deleteNode() {
  if (!selectedNodeId.value || isProtectedSelectedNode.value) return
  const nodeId = selectedNodeId.value
  const updatedNodes = nodes.value.filter((n) => n.id !== nodeId)
  const updatedEdges = edges.value.filter((e) => e.source !== nodeId && e.target !== nodeId)
  graphNodesRef.value = updatedNodes
  graphEdgesRef.value = updatedEdges
  selectedNodeId.value = null
  saveGraph()
}

function deleteEdge(edgeId: string) {
  const updatedEdges = edges.value.filter((e) => e.id !== edgeId)
  graphEdgesRef.value = updatedEdges
  saveGraph()
}

const BASE_NODE_TYPE_OPTIONS = [
  { label: "Call", value: "call" },
  { label: "Condition", value: "condition" },
  { label: "Delay", value: "delay" },
  { label: "Fork", value: "fork" },
  { label: "Join", value: "join" },
  { label: "Loop", value: "loop" },
  { label: "Switch", value: "switch" },
  { label: "Transform", value: "transform" },
  { label: "Subflow", value: "subflow" },
]

const LOCKED_NODE_TYPE_LABELS: Record<string, string> = {
  trigger: "Trigger",
  call: "Call",
  input: "Input",
  output: "Output",
}

const NODE_TYPE_OPTIONS = computed(() => {
  const allowed = new Set(getAllowedNodeTypes(flowKind.value))
  const options = BASE_NODE_TYPE_OPTIONS.filter((option) => allowed.has(option.value as never))
  if (node.value && !options.some((option) => option.value === node.value?.type)) {
    return [
      {
        label: LOCKED_NODE_TYPE_LABELS[node.value.type] ?? node.value.type,
        value: node.value.type,
      },
      ...options,
    ]
  }
  return options
})

const TRIGGER_TYPE_OPTIONS = [
  { label: "Manual", value: "manual" },
  { label: "Event", value: "event" },
  { label: "Schedule", value: "schedule" },
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

function prependCurrentOption(options: SelectOption[], currentValue: string): SelectOption[] {
  if (!currentValue || options.some((option) => option.value === currentValue)) {
    return options
  }

  return [{ label: currentValue, value: currentValue }, ...options]
}

const selectedProcedureModule = computed(() => {
  const moduleName = node.value?.data.module
  return typeof moduleName === "string" ? moduleName : ""
})

const selectedProcedureName = computed(() => {
  const procedureName = node.value?.data.procedure
  return typeof procedureName === "string" ? procedureName : ""
})

const selectedTriggerSource = computed<FlowTrigger>(
  () => getTriggerSourceFromNodeData(node.value?.data) ?? DEFAULT_FLOW_TRIGGER,
)

const selectedTriggerType = computed(() => selectedTriggerSource.value.type)

const selectedTriggerEvent = computed(() =>
  selectedTriggerSource.value.type === "event" ? selectedTriggerSource.value.event : "",
)

const selectedTriggerDays = computed(() =>
  selectedTriggerSource.value.type === "schedule"
    ? (selectedTriggerSource.value.days ?? []).join(", ")
    : "",
)

const triggerEventOptions = computed(() =>
  prependCurrentOption(
    listSubscriptionProcedureOptions(procedureCatalog.value),
    selectedTriggerEvent.value,
  ),
)

const availableProcedureModuleOptions = computed(() =>
  listCallableModuleOptions(procedureCatalog.value),
)

const procedureModuleOptions = computed(() =>
  prependCurrentOption(availableProcedureModuleOptions.value, selectedProcedureModule.value),
)

const availableProcedureOptions = computed(() =>
  listCallableProcedureOptions(procedureCatalog.value, selectedProcedureModule.value),
)

const procedureOptions = computed(() =>
  prependCurrentOption(availableProcedureOptions.value, selectedProcedureName.value),
)

function getSelectStringValue(value: unknown): string | null {
  if (typeof value === "string") return value
  if (Array.isArray(value)) return getSelectStringValue(value[0])
  if (typeof value === "object" && value !== null && "value" in value) {
    const next = (value as { value?: unknown }).value
    return typeof next === "string" ? next : null
  }
  return null
}

function updateTriggerNodeSource(source: FlowTrigger) {
  if (!node.value) return

  const updatedNodes = nodes.value.map((n) => {
    if (n.id !== selectedNodeId.value) return n

    return {
      ...n,
      data: {
        ...n.data,
        ...getTriggerNodeData(source),
      },
    }
  })

  graphNodesRef.value = updatedNodes
  saveGraph()
}

function updateTriggerType(value: unknown) {
  const triggerType = getSelectStringValue(value)
  if (!triggerType) return

  const current = selectedTriggerSource.value

  switch (triggerType) {
    case "event":
      updateTriggerNodeSource(
        current.type === "event" ? current : { type: "event", event: "", filter: undefined },
      )
      return
    case "schedule":
      updateTriggerNodeSource(
        current.type === "schedule"
          ? current
          : { type: "schedule", every: "1h", at: undefined, days: undefined },
      )
      return
    case "manual":
    default:
      updateTriggerNodeSource({ type: "manual" })
  }
}

function updateTriggerEvent(value: unknown) {
  const event = typeof value === "string" ? value : ""
  const current = selectedTriggerSource.value

  updateTriggerNodeSource({
    type: "event",
    event,
    filter: current.type === "event" ? current.filter : undefined,
  })
}

function updateTriggerScheduleEvery(value: unknown) {
  const every = typeof value === "string" ? value : ""
  const current = selectedTriggerSource.value

  updateTriggerNodeSource({
    type: "schedule",
    every,
    at: current.type === "schedule" ? current.at : undefined,
    days: current.type === "schedule" ? current.days : undefined,
  })
}

function updateTriggerScheduleAt(value: unknown) {
  const at = typeof value === "string" ? value.trim() : ""
  const current = selectedTriggerSource.value

  updateTriggerNodeSource({
    type: "schedule",
    every: current.type === "schedule" ? current.every : "1h",
    at: at === "" ? undefined : at,
    days: current.type === "schedule" ? current.days : undefined,
  })
}

function updateTriggerScheduleDays(value: unknown) {
  const daysInput = typeof value === "string" ? value : ""
  const days = daysInput
    .split(",")
    .map((day) => day.trim().toLowerCase())
    .filter(
      (day): day is ScheduleDay =>
        day === "mon" ||
        day === "tue" ||
        day === "wed" ||
        day === "thu" ||
        day === "fri" ||
        day === "sat" ||
        day === "sun",
    )
  const current = selectedTriggerSource.value

  updateTriggerNodeSource({
    type: "schedule",
    every: current.type === "schedule" ? current.every : "1h",
    at: current.type === "schedule" ? current.at : undefined,
    days: days.length > 0 ? days : undefined,
  })
}

function updateProcedureModule(value: unknown) {
  if (!node.value) return

  const moduleName = getSelectStringValue(value) ?? ""
  const allowedProcedureNames = new Set(
    listCallableProcedureOptions(procedureCatalog.value, moduleName).map((option) => option.value),
  )
  const currentProcedureName = selectedProcedureName.value
  const nextProcedureName = allowedProcedureNames.has(currentProcedureName)
    ? currentProcedureName
    : ""

  const updatedNodes = nodes.value.map((n) => {
    if (n.id !== selectedNodeId.value) return n

    return {
      ...n,
      data: {
        ...n.data,
        module: moduleName,
        procedure: nextProcedureName || undefined,
      },
    }
  })

  graphNodesRef.value = updatedNodes
  saveGraph()
}

function updateProcedureName(value: unknown) {
  if (!node.value) return

  const procedureName = getSelectStringValue(value) ?? ""
  const updatedNodes = nodes.value.map((n) => {
    if (n.id !== selectedNodeId.value) return n

    return {
      ...n,
      data: {
        ...n.data,
        procedure: procedureName || undefined,
      },
    }
  })

  graphNodesRef.value = updatedNodes
  saveGraph()
}

function changeNodeType(newType: unknown) {
  if (!node.value || isProtectedSelectedNode.value) return
  const rawType = getSelectStringValue(newType)
  if (!rawType) return

  const updatedNodes = nodes.value.map((n) => {
    if (n.id !== selectedNodeId.value) return n
    return { ...n, type: rawType, data: { ...n.data, type: rawType, nodeType: rawType } }
  })
  graphNodesRef.value = updatedNodes
  saveGraph()
}

const incomingEdges = computed(() => {
  if (!node.value) return []
  return edges.value.filter((e) => e.target === node.value!.id)
})

const outgoingEdges = computed(() => {
  if (!node.value) return []
  return edges.value.filter((e) => e.source === node.value!.id)
})

const nodeContract = computed(() => {
  if (!node.value) return null

  return buildNodeContract({
    node: {
      id: node.value.id,
      type: node.value.type,
      data: node.value.data,
    },
    procedureCatalog: procedureCatalog.value,
    projectFlows: projectFlows.value,
  })
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
                :disabled="isProtectedSelectedNode"
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
                  :model-value="selectedTriggerType"
                  :items="TRIGGER_TYPE_OPTIONS"
                  value-key="value"
                  label-key="label"
                  size="sm"
                  @update:model-value="updateTriggerType"
                />
              </div>
              <div v-if="selectedTriggerType === 'schedule'" class="flex flex-col gap-1.5">
                <label class="text-muted text-xs font-medium">{{
                  t({ en: "Interval", ru: "Интервал" })
                }}</label>
                <UInput
                  :model-value="
                    selectedTriggerSource.type === 'schedule' ? selectedTriggerSource.every : ''
                  "
                  size="sm"
                  placeholder="15m"
                  @update:model-value="updateTriggerScheduleEvery"
                />
              </div>
              <div v-if="selectedTriggerType === 'schedule'" class="flex flex-col gap-1.5">
                <label class="text-muted text-xs font-medium">{{
                  t({ en: "At time", ru: "Время" })
                }}</label>
                <UInput
                  :model-value="
                    selectedTriggerSource.type === 'schedule' ? selectedTriggerSource.at || '' : ''
                  "
                  size="sm"
                  placeholder="09:00"
                  @update:model-value="updateTriggerScheduleAt"
                />
              </div>
              <div v-if="selectedTriggerType === 'schedule'" class="flex flex-col gap-1.5">
                <label class="text-muted text-xs font-medium">{{
                  t({ en: "Days", ru: "Дни" })
                }}</label>
                <UInput
                  :model-value="selectedTriggerDays"
                  size="sm"
                  placeholder="mon, tue, wed"
                  @update:model-value="updateTriggerScheduleDays"
                />
              </div>
              <div v-if="selectedTriggerType === 'event'" class="flex flex-col gap-1.5">
                <label class="text-muted text-xs font-medium">{{
                  t({ en: "Event name", ru: "Имя события" })
                }}</label>
                <USelect
                  v-if="triggerEventOptions.length > 0"
                  :model-value="selectedTriggerEvent || undefined"
                  :items="triggerEventOptions"
                  value-key="value"
                  label-key="label"
                  size="sm"
                  :loading="procedureCatalogLoading"
                  @update:model-value="updateTriggerEvent"
                />
                <UInput
                  v-else
                  :model-value="
                    selectedTriggerSource.type === 'event' ? selectedTriggerSource.event : ''
                  "
                  size="sm"
                  placeholder="data.itemCreated"
                  @update:model-value="updateTriggerEvent"
                />
              </div>
            </template>

            <!-- Procedure call config -->
            <template v-if="node.data.type === 'call' || node.type === 'call'">
              <div class="flex flex-col gap-1.5">
                <label class="text-muted text-xs font-medium">Module</label>
                <USelect
                  v-if="procedureModuleOptions.length > 0"
                  :model-value="selectedProcedureModule || undefined"
                  :items="procedureModuleOptions"
                  value-key="value"
                  label-key="label"
                  size="sm"
                  :loading="procedureCatalogLoading"
                  @update:model-value="updateProcedureModule"
                />
                <UInput
                  v-else
                  :model-value="node.data.module || ''"
                  size="sm"
                  placeholder="data"
                  @update:model-value="updateField('module', $event)"
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-muted text-xs font-medium">Procedure</label>
                <USelect
                  v-if="procedureOptions.length > 0"
                  :model-value="selectedProcedureName || undefined"
                  :items="procedureOptions"
                  value-key="value"
                  label-key="label"
                  size="sm"
                  :disabled="!selectedProcedureModule"
                  :loading="procedureCatalogLoading"
                  @update:model-value="updateProcedureName"
                />
                <UInput
                  v-else
                  :model-value="selectedProcedureName"
                  size="sm"
                  placeholder="createItem"
                  @update:model-value="updateProcedureName"
                />
              </div>
              <p v-if="procedureCatalogError" class="text-error text-xs">
                {{ procedureCatalogError }}
              </p>
              <p
                v-else-if="
                  selectedProcedureModule &&
                  availableProcedureOptions.length === 0 &&
                  procedureCatalog.length > 0
                "
                class="text-muted text-xs"
              >
                {{
                  t({
                    en: "Only query and mutation procedures are available for call nodes.",
                    ru: "Для call-нод доступны только query и mutation процедуры.",
                  })
                }}
              </p>
              <p v-else-if="procedureCatalog.length > 0" class="text-muted text-xs">
                {{
                  t({
                    en: "Procedure catalog comes from the installed Edem modules.",
                    ru: "Каталог процедур берётся из установленных Edem-модулей.",
                  })
                }}
              </p>
              <p v-else-if="procedureCatalogLoading" class="text-muted text-xs">
                {{ t({ en: "Loading procedure catalog…", ru: "Загружаю каталог процедур…" }) }}
              </p>
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

            <!-- Contract -->
            <template
              v-if="
                nodeContract &&
                (nodeContract.input.fields.length > 0 || nodeContract.output.fields.length > 0)
              "
            >
              <div class="flex flex-col gap-3">
                <div v-if="nodeContract.input.fields.length > 0" class="flex flex-col gap-1.5">
                  <p class="text-xs font-medium">{{ t({ en: "Input", ru: "Вход" }) }}</p>
                  <FlowContractFieldList :fields="nodeContract.input.fields" />
                </div>

                <div v-if="nodeContract.output.fields.length > 0" class="flex flex-col gap-1.5">
                  <p class="text-xs font-medium">{{ t({ en: "Output", ru: "Выход" }) }}</p>
                  <FlowContractFieldList :fields="nodeContract.output.fields" />
                </div>
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
            v-if="!isProtectedSelectedNode"
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
              {{
                t({
                  en: "Cannot delete or retype a system node",
                  ru: "Нельзя удалить или сменить тип системной ноды",
                })
              }}
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
