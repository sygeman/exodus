<script setup lang="ts">
import { computed, ref, watch, shallowRef, onMounted, onUnmounted } from "vue"
import { useFlow, useFlowRuns, useDeleteRuns, useRunFlow } from "@/hooks"
import { edem } from "@/edem"
import { parseEvery } from "@exodus/edem-flows"
import { useT } from "@exodus/edem-vue"

const t = useT()

function handleNavigatedebug_flows() {
  router.push("/debug/flows")
}

const props = defineProps<{ flowId: string }>()

const { data: flow } = useFlow(props.flowId)
const { data: runs, loading, refetch } = useFlowRuns(props.flowId)
const [deleteRuns, { loading: deleting }] = useDeleteRuns()
const [runFlow, { loading: running }] = useRunFlow()

const statusFilter = ref("all")
const expandedRunId = ref<string | null>(null)
const deleteModalOpen = ref(false)

const filteredRuns = computed(() => {
  const list =
    statusFilter.value === "all"
      ? runs.value
      : runs.value.filter((r) => r.status === statusFilter.value)
  return list.toSorted((a, b) => b.started_at - a.started_at)
})

const RUN_STATUS_CLASS: Record<string, string> = {
  running: "bg-blue-500/10 text-blue-500",
  completed: "bg-green-500/10 text-green-500",
  error: "bg-red-500/10 text-red-500",
  waiting: "bg-yellow-500/10 text-yellow-500",
  cancelled: "bg-gray-500/10 text-gray-500",
  pending: "bg-gray-500/10 text-gray-500",
}

const runStatusLabel: Record<string, string> = {
  running: "running",
  completed: "completed",
  error: "error",
  waiting: "waiting",
  cancelled: "cancelled",
  pending: "pending",
}

const statusOptions = computed(() => [
  { label: "All", value: "all" },
  { label: "Running", value: "running" },
  { label: "Completed", value: "completed" },
  { label: "Error", value: "error" },
  { label: "Waiting", value: "waiting" },
  { label: "Cancelled", value: "cancelled" },
])

interface RunNode {
  id: string
  run_id: string
  node_id: string
  status: string
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  error?: string
  attempts: number
  started_at: number
  completed_at?: number
}

const expandedNodes = shallowRef<RunNode[]>([])
const nodesLoading = ref(false)

const nodeById = computed(() => {
  const map = new Map<string, RunNode>()
  for (const node of expandedNodes.value) map.set(node.id, node)
  return map
})

const flowNodeMap = computed(() => {
  const map = new Map<string, { type: string; data?: Record<string, unknown> }>()
  for (const n of flow.value?.nodes ?? []) map.set(n.id, n)
  return map
})

watch(expandedRunId, async (runId) => {
  if (!runId) {
    expandedNodes.value = []
    return
  }
  nodesLoading.value = true
  try {
    const result = await edem.flows.getRunNodes({ run_id: runId })
    expandedNodes.value = result.nodes
  } catch {
    expandedNodes.value = []
  } finally {
    nodesLoading.value = false
  }
})

async function forceRun() {
  await runFlow({ flow_id: props.flowId })
}

const isScheduleTrigger = computed(() => flow.value?.trigger?.type === "schedule")
const scheduleEvery = computed(() => {
  if (!isScheduleTrigger.value) return null
  const every = (flow.value?.trigger as { every?: string })?.every
  if (!every) return null
  try {
    return parseEvery(every)
  } catch {
    return null
  }
})

const lastRunAt = computed(() => {
  if (runs.value.length > 0) return Math.max(...runs.value.map((r) => r.started_at))
  return ((flow.value as Record<string, unknown> | null)?.last_run_at as number) ?? null
})

const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  timer = setInterval(() => {
    now.value = Date.now()
  }, 1000)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})

const nextRunIn = computed(() => {
  if (!scheduleEvery.value || !lastRunAt.value) return null
  return lastRunAt.value + scheduleEvery.value - now.value
})

const isOverdue = computed(() => nextRunIn.value !== null && nextRunIn.value <= 0)

const countdownText = computed(() => {
  if (nextRunIn.value === null) return null
  const ms = Math.abs(nextRunIn.value)
  const totalSec = Math.floor(ms / 1000)
  const hours = Math.floor(totalSec / 3600)
  const min = Math.floor((totalSec % 3600) / 60)
  const sec = totalSec % 60
  const text = hours > 0 ? `${hours}h ${min}m` : min > 0 ? `${min}m ${sec}s` : `${sec}s`
  return isOverdue.value ? `+${text}` : text
})

const countdownPercent = computed(() => {
  if (!scheduleEvery.value || !lastRunAt.value) return 0
  return Math.min(100, ((now.value - lastRunAt.value) / scheduleEvery.value) * 100)
})

async function confirmDeleteRuns() {
  await deleteRuns({ flow_id: props.flowId })
  deleteModalOpen.value = false
  expandedRunId.value = null
  await refetch()
}

function toggleRun(runId: string) {
  expandedRunId.value = expandedRunId.value === runId ? null : runId
}
function formatTime(ts: number) {
  return new Date(ts).toLocaleString()
}
function formatDuration(start: number, end?: number | null) {
  const ms = (end ?? Date.now()) - start
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}
function formatJson(obj: unknown) {
  try {
    return JSON.stringify(obj, null, 2)
  } catch {
    return String(obj)
  }
}
function triggerTypeLabel(type: string) {
  const map: Record<string, string> = {
    schedule: "Schedule",
    webhook: "Webhook",
    event: "Event",
    manual: "Manual",
  }
  return map[type] ?? type
}
</script>

<template>
  <div class="bg-default flex h-full flex-col">
    <div class="border-default flex items-center gap-3 border-b px-4 py-3">
      <UButton
        icon="i-lucide-arrow-left"
        variant="ghost"
        size="xs"
        @click="handleNavigatedebug_flows()"
      />
      <div class="flex flex-1 flex-col">
        <h1 class="text-xl font-bold">{{ flow?.name ?? flowId }}</h1>
      </div>
      <UButton
        color="error"
        variant="subtle"
        size="xs"
        icon="i-lucide-trash-2"
        @click="confirmDeleteRuns($event)"
        >{{ t({ en: "Clear history", ru: "Очистить историю" }) }}</UButton
      >
    </div>
    <div class="border-default flex items-center gap-2 border-b px-4 py-2">
      <USelectMenu
        :model-value="statusFilter"
        :items="statusOptions"
        value-key="value"
        class="w-36"
      />
      <span class="text-muted text-xs"
        >{{ filteredRuns.length }}
        {{
          filteredRuns.length === 1
            ? t({ en: "run", ru: "запуск" })
            : t({ en: "runs", ru: "запусков" })
        }}</span
      >
    </div>
    <UScrollArea class="min-h-0 flex-1">
      <div v-for="(item, idx) in filteredRuns" :key="idx" class="flex flex-col gap-1 p-4">
        <button
          class="border-default hover:bg-elevated flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors"
        >
          <span
            class="inline-flex h-5 min-w-12 items-center justify-center rounded px-1.5 text-[10px] font-medium uppercase"
            >{{ runStatusLabel[item.status] ?? item.status }}</span
          >
          <span class="text-muted min-w-0 flex-1 truncate font-mono text-xs">{{
            item.id.slice(0, 8)
          }}</span>
          <span class="text-muted text-xs">{{
            formatDuration(item.started_at, item.completed_at)
          }}</span>
        </button>
      </div>
    </UScrollArea>
  </div>
</template>
