<script setup lang="ts">
import { computed, ref, watch, shallowRef, onMounted, onUnmounted } from "vue"
import { useT } from "@exodus/edem-vue"
import { useFlow, useFlowRuns, useDeleteRuns } from "@/hooks"
import { edem } from "@/edem"
import { parseEvery } from "@exodus/edem-flows"

const props = defineProps<{ flowId: string }>()

const t = useT()

const { data: flow } = useFlow(props.flowId)
const { data: runs, loading, refetch } = useFlowRuns(props.flowId)
const [deleteRuns, { loading: deleting }] = useDeleteRuns()

const statusFilter = ref("all")
const expandedRunId = ref<string | null>(null)
const deleteModalOpen = ref(false)

const filteredRuns = computed(() => {
  if (statusFilter.value === "all") return runs.value
  return runs.value.filter((r) => r.status === statusFilter.value)
})

const RUN_STATUS_CLASS: Record<string, string> = {
  running: "bg-blue-500/10 text-blue-500",
  completed: "bg-green-500/10 text-green-500",
  error: "bg-red-500/10 text-red-500",
  waiting: "bg-yellow-500/10 text-yellow-500",
  cancelled: "bg-gray-500/10 text-gray-500",
  pending: "bg-gray-500/10 text-gray-500",
}

const NODE_STATUS_CLASS: Record<string, string> = {
  running: "bg-blue-500/10 text-blue-500",
  completed: "bg-green-500/10 text-green-500",
  failed: "bg-red-500/10 text-red-500",
  pending: "bg-gray-500/10 text-gray-500",
}

const statusOptions = computed<{ label: string; value: string }[]>(() => [
  { label: t({ en: "All", ru: "Все" }), value: "all" },
  { label: t({ en: "Running", ru: "Выполняется" }), value: "running" },
  { label: t({ en: "Completed", ru: "Завершён" }), value: "completed" },
  { label: t({ en: "Error", ru: "Ошибка" }), value: "error" },
  { label: t({ en: "Waiting", ru: "Ожидание" }), value: "waiting" },
  { label: t({ en: "Cancelled", ru: "Отменён" }), value: "cancelled" },
])

const expandedNodes = shallowRef<
  Array<{
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
  }>
>([])
const nodesLoading = ref(false)

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
  if (runs.value.length === 0) return null
  return Math.max(...runs.value.map((r) => r.started_at))
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
  const text = hours > 0 ? `${hours}h ${min}m` : min > 0 ? `${min}m ${sec}s` : `${sec}s`
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
        <span v-if="flow" class="text-muted text-xs">{{ flow.trigger?.type }}</span>
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
              {{ run.status }}
            </span>
            <span class="text-muted min-w-0 flex-1 truncate font-mono text-xs">{{
              run.id.slice(0, 8)
            }}</span>
            <span class="text-muted text-xs">{{ formatTime(run.started_at) }}</span>
            <span class="text-muted text-xs">
              {{ formatDuration(run.started_at, run.completed_at) }}
            </span>
            <UIcon
              :name="expandedRunId === run.id ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
              class="text-muted h-4 w-4"
            />
          </button>

          <!-- Expanded: run nodes -->
          <div v-if="expandedRunId === run.id" class="mt-1 ml-4 border-l-2 pl-3">
            <div v-if="nodesLoading" class="py-2">
              <USkeleton class="h-4 w-32" />
            </div>
            <div v-else-if="expandedNodes.length === 0" class="text-muted py-2 text-xs">
              {{ t({ en: "No nodes.", ru: "Нет нод." }) }}
            </div>
            <div v-else class="flex flex-col gap-1 py-1">
              <div
                v-for="node in expandedNodes"
                :key="node.id"
                class="rounded-md bg-black/5 px-3 py-2 text-xs"
              >
                <div class="flex items-center gap-2">
                  <span
                    class="inline-flex h-4 min-w-14 items-center justify-center rounded px-1 text-[9px] font-medium uppercase"
                    :class="NODE_STATUS_CLASS[node.status]"
                  >
                    {{ node.status }}
                  </span>
                  <span class="font-mono font-medium">{{ node.node_id }}</span>
                  <span v-if="node.attempts > 1" class="text-muted text-[10px]">
                    attempt {{ node.attempts }}
                  </span>
                </div>
                <div v-if="node.error" class="text-error mt-1 text-[11px]">
                  {{ node.error }}
                </div>
                <div
                  v-if="node.output"
                  class="text-muted mt-1 max-h-32 overflow-auto font-mono text-[10px]"
                >
                  <pre>{{ formatJson(node.output) }}</pre>
                </div>
              </div>
            </div>
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
