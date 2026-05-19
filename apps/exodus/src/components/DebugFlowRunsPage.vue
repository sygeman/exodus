<script setup lang="ts">
import { computed, ref, watch, shallowRef, onMounted, onUnmounted } from "vue"
import { useT } from "@exodus/edem-vue"
import { useFlow, useFlowRuns, useDeleteRuns, useRunFlow } from "@/hooks"
import { edem } from "@/edem"
import { parseEvery } from "@exodus/edem-flows"

const props = defineProps<{ flowId: string }>()

const t = useT()

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

// ── Run status ───────────────────────────────────────────────────────────────

const RUN_STATUS_CLASS: Record<string, string> = {
  running: "bg-blue-500/10 text-blue-500",
  completed: "bg-green-500/10 text-green-500",
  error: "bg-red-500/10 text-red-500",
  waiting: "bg-yellow-500/10 text-yellow-500",
  cancelled: "bg-gray-500/10 text-gray-500",
  pending: "bg-gray-500/10 text-gray-500",
}

const runStatusLabel: Record<string, string> = {
  running: t({ en: "running", ru: "выполняется" }),
  completed: t({ en: "completed", ru: "завершён" }),
  error: t({ en: "error", ru: "ошибка" }),
  waiting: t({ en: "waiting", ru: "ожидание" }),
  cancelled: t({ en: "cancelled", ru: "отменён" }),
  pending: t({ en: "pending", ru: "в очереди" }),
}

const statusOptions = computed<{ label: string; value: string }[]>(() => [
  { label: t({ en: "All", ru: "Все" }), value: "all" },
  { label: t({ en: "Running", ru: "Выполняется" }), value: "running" },
  { label: t({ en: "Completed", ru: "Завершён" }), value: "completed" },
  { label: t({ en: "Error", ru: "Ошибка" }), value: "error" },
  { label: t({ en: "Waiting", ru: "Ожидание" }), value: "waiting" },
  { label: t({ en: "Cancelled", ru: "Отменён" }), value: "cancelled" },
])

// ── Node status ──────────────────────────────────────────────────────────────

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

const NODE_ICON: Record<string, string> = {
  running: "i-lucide-loader",
  completed: "i-lucide-check-circle",
  failed: "i-lucide-x-circle",
  pending: "i-lucide-clock",
}

const NODE_COLOR: Record<string, "primary" | "success" | "error" | "neutral"> = {
  running: "primary",
  completed: "success",
  failed: "error",
  pending: "neutral",
}

const NODE_TYPE_LABEL: Record<string, string> = {
  trigger: t({ en: "Trigger", ru: "Триггер" }),
  condition: t({ en: "Condition", ru: "Условие" }),
  transform: t({ en: "Transform", ru: "Трансформация" }),
  switch: t({ en: "Switch", ru: "Переключатель" }),
  delay: t({ en: "Delay", ru: "Задержка" }),
  input: t({ en: "Input", ru: "Вход" }),
  output: t({ en: "Output", ru: "Выход" }),
  action: t({ en: "Action", ru: "Действие" }),
  loop: t({ en: "Loop", ru: "Цикл" }),
  fork: t({ en: "Fork", ru: "Ветвление" }),
  join: t({ en: "Join", ru: "Соединение" }),
  subflow: t({ en: "Subflow", ru: "Подфлоу" }),
}

// ── Expanded run nodes ───────────────────────────────────────────────────────

const expandedNodes = shallowRef<RunNode[]>([])
const nodesLoading = ref(false)

const nodeById = computed(() => {
  const map = new Map<string, RunNode>()
  for (const node of expandedNodes.value) {
    map.set(node.id, node)
  }
  return map
})

const flowNodeMap = computed(() => {
  const map = new Map<string, { type: string; data?: Record<string, unknown> }>()
  for (const n of flow.value?.nodes ?? []) {
    map.set(n.id, n)
  }
  return map
})

const timelineItems = computed(() =>
  expandedNodes.value.map((node) => {
    const flowNode = flowNodeMap.value.get(node.node_id)
    const type = flowNode?.type ?? ""
    const name = (flowNode?.data?.name as string) || NODE_TYPE_LABEL[type] || type
    return {
      title: name,
      date: formatDuration(node.started_at, node.completed_at),
      icon: NODE_ICON[node.status] ?? "i-lucide-circle",
      color: NODE_COLOR[node.status] ?? "neutral",
      value: node.id,
    }
  }),
)

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

// ── Force run ────────────────────────────────────────────────────────────────

async function forceRun() {
  await runFlow({ flow_id: props.flowId })
}

// ── Countdown for schedule triggers ──────────────────────────────────────────

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
  const flowLastRun = (flow.value as Record<string, unknown> | null)?.last_run_at as
    | number
    | undefined
  return flowLastRun ?? null
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
  const next = lastRunAt.value + scheduleEvery.value
  return next - now.value
})

const isOverdue = computed(() => nextRunIn.value !== null && nextRunIn.value <= 0)

const countdownText = computed(() => {
  if (nextRunIn.value === null) return null
  const ms = Math.abs(nextRunIn.value)
  const totalSec = Math.floor(ms / 1000)
  const hours = Math.floor(totalSec / 3600)
  const min = Math.floor((totalSec % 3600) / 60)
  const sec = totalSec % 60
  const text =
    hours > 0
      ? `${t({ en: "{n}h", ru: "{n}ч" }, { n: hours })} ${t({ en: "{n}m", ru: "{n}м" }, { n: min })}`
      : min > 0
        ? `${t({ en: "{n}m", ru: "{n}м" }, { n: min })} ${t({ en: "{n}s", ru: "{n}с" }, { n: sec })}`
        : t({ en: "{n}s", ru: "{n}с" }, { n: sec })
  return isOverdue.value ? `+${text}` : text
})

const countdownPercent = computed(() => {
  if (!scheduleEvery.value || !lastRunAt.value) return 0
  const elapsed = now.value - lastRunAt.value
  return Math.min(100, (elapsed / scheduleEvery.value) * 100)
})

// ── Delete runs ──────────────────────────────────────────────────────────────

async function confirmDeleteRuns() {
  await deleteRuns({ flow_id: props.flowId })
  deleteModalOpen.value = false
  expandedRunId.value = null
  await refetch()
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function toggleRun(runId: string) {
  expandedRunId.value = expandedRunId.value === runId ? null : runId
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleString()
}

function formatDuration(start: number, end?: number | null) {
  const ms = (end ?? Date.now()) - start
  if (ms < 1000) return t({ en: "{n}ms", ru: "{n}мс" }, { n: ms })
  if (ms < 60000) return t({ en: "{n}s", ru: "{n}с" }, { n: (ms / 1000).toFixed(1) })
  return `${t({ en: "{n}m", ru: "{n}м" }, { n: Math.floor(ms / 60000) })} ${t({ en: "{n}s", ru: "{n}с" }, { n: Math.floor((ms % 60000) / 1000) })}`
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
    schedule: t({ en: "Schedule", ru: "По расписанию" }),
    event: t({ en: "Event", ru: "Событие" }),
    manual: t({ en: "Manual", ru: "Ручной" }),
  }
  return map[type] ?? type
}
</script>

<template>
  <div class="bg-default flex h-full flex-col">
    <!-- Header -->
    <div class="border-default flex items-center gap-3 border-b px-4 py-3">
      <UButton
        icon="i-lucide-arrow-left"
        variant="ghost"
        size="xs"
        @click="$router.push('/debug/flows')"
      />
      <div class="flex flex-1 flex-col">
        <h1 class="text-xl font-bold">{{ flow?.name ?? flowId }}</h1>
        <span v-if="flow" class="text-muted text-xs">
          {{ triggerTypeLabel(flow.trigger?.type ?? "") }}
          <template v-if="flow.trigger?.type === 'schedule'">
            · {{ (flow.trigger as { every?: string })?.every }}
            <template v-if="(flow.trigger as { at?: string })?.at">
              {{ t({ en: "at", ru: "в" }) }} {{ (flow.trigger as { at?: string }).at }}</template
            >
          </template>
        </span>
      </div>
      <UButton
        v-if="runs.length > 0"
        color="error"
        variant="subtle"
        size="xs"
        icon="i-lucide-trash-2"
        :disabled="deleting"
        @click="deleteModalOpen = true"
      >
        {{ t({ en: "Clear history", ru: "Очистить историю" }) }}
      </UButton>
    </div>

    <!-- Countdown bar for schedule triggers -->
    <div
      v-if="isScheduleTrigger && scheduleEvery"
      class="border-default flex items-center gap-3 border-b px-4 py-2"
    >
      <UIcon name="i-lucide-clock" class="text-muted h-4 w-4" />
      <div class="min-w-0 flex-1">
        <div class="bg-muted/30 h-1.5 w-full overflow-hidden rounded-full">
          <div
            class="h-full rounded-full transition-all duration-1000 ease-linear"
            :class="isOverdue ? 'bg-error' : 'bg-primary'"
            :style="{ width: `${countdownPercent}%` }"
          />
        </div>
      </div>
      <span class="text-muted min-w-16 text-right font-mono text-xs">
        {{ countdownText }}
      </span>
      <UButton
        color="primary"
        variant="subtle"
        size="xs"
        icon="i-lucide-play"
        :loading="running"
        @click="forceRun"
      >
        {{ t({ en: "Run now", ru: "Запустить сейчас" }) }}
      </UButton>
    </div>

    <!-- Filters -->
    <div class="border-default flex items-center gap-2 border-b px-4 py-2">
      <USelectMenu v-model="statusFilter" :items="statusOptions" value-key="value" class="w-36" />
      <span class="text-muted text-xs">
        {{ filteredRuns.length }}
        {{
          filteredRuns.length === 1
            ? t({ en: "run", ru: "запуск" })
            : t({ en: "runs", ru: "запусков" })
        }}
      </span>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex flex-1 flex-col gap-2 p-4">
      <div v-for="i in 5" :key="i" class="border-default rounded-lg border p-4">
        <USkeleton class="h-5 w-48" />
      </div>
    </div>

    <!-- Empty -->
    <div
      v-else-if="filteredRuns.length === 0"
      class="text-muted flex flex-1 items-center justify-center p-8 text-sm"
    >
      {{ t({ en: "No runs.", ru: "Нет запусков." }) }}
    </div>

    <!-- Runs list -->
    <UScrollArea v-else class="min-h-0 flex-1">
      <div class="flex flex-col gap-1 p-4">
        <div v-for="run in filteredRuns" :key="run.id">
          <button
            class="border-default hover:bg-elevated flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors"
            @click="toggleRun(run.id)"
          >
            <span
              class="inline-flex h-5 min-w-12 items-center justify-center rounded px-1.5 text-[10px] font-medium uppercase"
              :class="RUN_STATUS_CLASS[run.status]"
            >
              {{ runStatusLabel[run.status] ?? run.status }}
            </span>
            <span class="text-muted min-w-0 flex-1 truncate font-mono text-xs">{{
              run.id.slice(0, 8)
            }}</span>
            <span class="text-muted text-xs">
              {{ formatDuration(run.started_at, run.completed_at) }}
            </span>
            <span class="text-muted text-xs">{{ formatTime(run.started_at) }}</span>
            <UIcon
              :name="expandedRunId === run.id ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
              class="text-muted h-4 w-4"
            />
          </button>

          <!-- Expanded: run nodes -->
          <div v-if="expandedRunId === run.id" class="mt-1 ml-4 pl-3">
            <div v-if="nodesLoading" class="py-2">
              <USkeleton class="h-4 w-32" />
            </div>
            <div v-else-if="expandedNodes.length === 0" class="text-muted py-2 text-xs">
              {{ t({ en: "No nodes.", ru: "Нет нод." }) }}
            </div>
            <UTimeline v-else :items="timelineItems" size="sm" class="py-2">
              <template #description="{ item }">
                <div
                  v-for="node in [nodeById.get(item.value as string)]"
                  :key="item.value"
                  class="mt-1"
                >
                  <template v-if="node">
                    <span v-if="node.attempts > 1" class="text-muted text-[10px]">
                      {{ t({ en: "attempt", ru: "попытка" }) }} {{ node.attempts }}
                    </span>
                    <div v-if="node.error" class="text-error text-[11px]">
                      {{ node.error }}
                    </div>
                    <div
                      v-if="node.output"
                      class="text-muted mt-1 max-h-32 overflow-auto font-mono text-[10px]"
                    >
                      <pre>{{ formatJson(node.output) }}</pre>
                    </div>
                  </template>
                </div>
              </template>
            </UTimeline>
          </div>
        </div>
      </div>
    </UScrollArea>

    <!-- Delete confirmation modal -->
    <UModal
      v-model:open="deleteModalOpen"
      :title="t({ en: 'Clear run history?', ru: 'Очистить историю запусков?' })"
      :description="
        t({
          en: 'All run records and node execution data for this flow will be permanently deleted.',
          ru: 'Все записи запусков и данные выполнения нод для этого флоу будут безвозвратно удалены.',
        })
      "
    >
      <template #footer>
        <div class="flex w-full justify-end gap-3">
          <UButton variant="ghost" @click="deleteModalOpen = false">
            {{ t({ en: "Cancel", ru: "Отмена" }) }}
          </UButton>
          <UButton color="error" :loading="deleting" @click="confirmDeleteRuns">
            {{ t({ en: "Delete", ru: "Удалить" }) }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
