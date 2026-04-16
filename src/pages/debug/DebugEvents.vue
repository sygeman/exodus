<script setup lang="ts">
import { ref, computed } from "vue"
import { useI18n } from "vue-i18n"
import { useEventoDebugger } from "@/composables/useEventoDebugger"

const { filteredLogs, isPaused, clearLogs, togglePause } = useEventoDebugger()

const { t } = useI18n()

const selectedLog = ref<(typeof logRows.value)[0] | null>(null)

const logFilter = ref("")

const filteredLogRows = computed(() => {
  const q = logFilter.value.trim().toLowerCase()
  if (!q) return logRows.value
  return logRows.value.filter((row) =>
    [row.time, row.name, row.source, row.depth, row.trace, row.payload].some((field) =>
      String(field).toLowerCase().includes(q),
    ),
  )
})

function formatTime(ts: number) {
  const d = new Date(ts)
  return d.toLocaleTimeString() + "." + String(d.getMilliseconds()).padStart(3, "0")
}

function formatPayload(payload: unknown) {
  if (payload === undefined) return "undefined"
  try {
    return JSON.stringify(payload, null, 2)
  } catch {
    return String(payload)
  }
}

const logRows = computed(() =>
  filteredLogs.value.map((log) => ({
    id: log.id,
    time: formatTime(log.timestamp),
    name: log.name,
    source: log.meta.source,
    depth: String(log.meta.depth),
    trace: log.meta.trace_id,
    payload: formatPayload(log.payload),
  })),
)
</script>

<template>
  <div class="flex h-full flex-col bg-[var(--ui-bg)]">
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-[var(--ui-border)] px-4 py-3">
      <div class="flex items-center gap-3">
        <h1 class="text-xl font-bold">{{ t("common.events") }}</h1>
        <UBadge v-if="isPaused" color="warning" variant="subtle">{{ t("common.paused") }}</UBadge>
      </div>
      <div class="flex items-center gap-2">
        <UButton :color="isPaused ? 'warning' : 'neutral'" variant="subtle" @click="togglePause">
          {{ isPaused ? t("common.resume") : t("common.pause") }}
        </UButton>
        <UButton color="error" variant="subtle" @click="clearLogs">{{ t("common.clear") }}</UButton>
      </div>
    </div>

    <!-- Log Filter -->
    <div class="flex gap-2 border-b border-[var(--ui-border)] px-2 py-1.5">
      <UInput v-model="logFilter" :placeholder="t('events.searchLogs')" class="min-w-0 flex-1" />
    </div>

    <!-- Log Stream -->
    <UScrollArea class="min-h-0 flex-1">
      <div
        v-for="row in filteredLogRows"
        :key="row.id"
        class="cursor-pointer border-b border-[var(--ui-border)] px-3 py-2 text-xs leading-relaxed hover:bg-[var(--ui-bg-elevated)]"
        @click="selectedLog = row"
      >
        <div class="flex items-center gap-2">
          <span class="font-mono text-[var(--ui-text-muted)]">{{ row.time }}</span>
          <code class="text-sm text-[var(--ui-primary)]">{{ row.name }}</code>
          <span class="text-[var(--ui-text-muted)]">{{ row.source }}</span>
          <span class="text-[var(--ui-text-muted)]">d{{ row.depth }}</span>
          <span
            v-if="row.payload !== 'undefined'"
            class="min-w-0 flex-1 truncate text-[var(--ui-text-muted)]"
          >
            {{ row.payload }}
          </span>
        </div>
      </div>
      <div
        v-if="filteredLogRows.length === 0"
        class="p-4 text-center text-sm text-[var(--ui-text-muted)]"
      >
        {{ t("common.noEvents") }}
      </div>
    </UScrollArea>
  </div>

  <UModal
    :open="!!selectedLog"
    @update:open="
      (v) => {
        if (!v) selectedLog = null
      }
    "
  >
    <template #content>
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold">
              {{ t("events.eventDetails") }}
            </h2>
            <UButton
              icon="i-lucide-x"
              variant="ghost"
              color="neutral"
              @click="selectedLog = null"
            />
          </div>
        </template>
        <UScrollArea class="max-h-[60vh]">
          <div v-if="selectedLog" class="space-y-3 text-sm">
            <div class="grid grid-cols-[5rem_1fr] items-baseline gap-2">
              <span class="text-[var(--ui-text-muted)]">{{ t("common.time") }}</span>
              <span class="font-mono">{{ selectedLog.time }}</span>
            </div>
            <div class="grid grid-cols-[5rem_1fr] items-baseline gap-2">
              <span class="text-[var(--ui-text-muted)]">{{ t("common.events") }}</span>
              <code class="font-mono text-[var(--ui-primary)]">{{ selectedLog.name }}</code>
            </div>
            <div class="grid grid-cols-[5rem_1fr] items-baseline gap-2">
              <span class="text-[var(--ui-text-muted)]">{{ t("common.source") }}</span>
              <span>{{ selectedLog.source }}</span>
            </div>
            <div class="grid grid-cols-[5rem_1fr] items-baseline gap-2">
              <span class="text-[var(--ui-text-muted)]">{{ t("common.depth") }}</span>
              <span>{{ selectedLog.depth }}</span>
            </div>
            <div class="grid grid-cols-[5rem_1fr] items-baseline gap-2">
              <span class="text-[var(--ui-text-muted)]">{{ t("common.trace") }}</span>
              <span class="truncate font-mono text-[var(--ui-text-muted)]">{{
                selectedLog.trace
              }}</span>
            </div>
            <div v-if="selectedLog.payload !== 'undefined'" class="space-y-1">
              <span class="text-[var(--ui-text-muted)]">{{ t("common.payload") }}</span>
              <pre class="overflow-auto rounded bg-[var(--ui-bg-elevated)] px-3 py-2 text-xs">{{
                selectedLog.payload
              }}</pre>
            </div>
          </div>
        </UScrollArea>
      </UCard>
    </template>
  </UModal>
</template>
