<script setup lang="ts">
import { useLogger } from "@/modules/logger/composables/useLogger"

const emit = defineEmits<{
  (e: "close"): void
}>()

const {
  logs,
  total,
  page,
  totalPages,
  levelFilter,
  sourceFilter,
  textFilter,
  isPaused,
  loading,
  stats,
  clear,
  togglePause,
  formatTime,
  nextPage,
  prevPage,
  firstPage,
  lastPage,
} = useLogger()

const levelOptions: { label: string; value: string }[] = [
  { label: "All", value: "all" },
  { label: "Debug", value: "debug" },
  { label: "Info", value: "info" },
  { label: "Warn", value: "warn" },
  { label: "Error", value: "error" },
]

const sourceOptions: { label: string; value: string }[] = [
  { label: "All", value: "all" },
  { label: "Bun", value: "bun" },
  { label: "Webview", value: "webview" },
]

const levelBadgeColor = (level: string) => {
  switch (level) {
    case "error":
      return "error"
    case "warn":
      return "warning"
    case "debug":
      return "info"
    default:
      return "neutral"
  }
}

function formatArgs(args: unknown[]) {
  if (!args.length) return ""
  return args
    .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
    .join(" ")
}
</script>

<template>
  <UModal :open="true" :dismissible="false" fullscreen @update:open="(v) => { if (!v) emit('close') }">
    <template #content>
      <div class="flex flex-col h-full bg-[var(--ui-bg)]">
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-[var(--ui-border)]">
          <div class="flex items-center gap-3">
            <UButton icon="i-lucide-arrow-left" variant="ghost" @click="emit('close')" />
            <h1 class="text-xl font-bold">Logs</h1>
            <UBadge v-if="isPaused" color="warning" variant="subtle">Paused</UBadge>
          </div>
          <div class="flex items-center gap-2">
            <div class="hidden sm:flex items-center gap-2 text-xs text-[var(--ui-text-muted)] mr-2">
              <span>D {{ stats.debug }}</span>
              <span>I {{ stats.info }}</span>
              <span>W {{ stats.warn }}</span>
              <span>E {{ stats.error }}</span>
            </div>
            <UButton
              :color="isPaused ? 'warning' : 'neutral'"
              variant="subtle"
              @click="togglePause"
            >
              {{ isPaused ? "Resume" : "Pause" }}
            </UButton>
            <UButton color="error" variant="subtle" @click="clear">Clear</UButton>
          </div>
        </div>

        <!-- Filters -->
        <div class="flex flex-wrap gap-2 px-4 py-2 border-b border-[var(--ui-border)]">
          <USelectMenu v-model="levelFilter" :items="levelOptions" value-key="value" class="w-28" />
          <USelectMenu v-model="sourceFilter" :items="sourceOptions" value-key="value" class="w-28" />
          <UInput v-model="textFilter" placeholder="Search logs" class="flex-1 min-w-0" />
        </div>

        <!-- Logs list -->
        <UScrollArea class="flex-1 min-h-0">
          <div
            v-for="log in logs"
            :key="log.id"
            class="px-4 py-2 border-b border-[var(--ui-border)] text-xs leading-relaxed hover:bg-[var(--ui-bg-elevated)]"
          >
            <div class="flex items-center gap-2">
              <span class="font-mono text-[var(--ui-text-muted)]">{{ formatTime(log.timestamp) }}</span>
              <UBadge :color="levelBadgeColor(log.level)" variant="subtle" class="text-[10px] uppercase">
                {{ log.level }}
              </UBadge>
              <span
                class="text-[10px] uppercase px-1.5 py-0.5 rounded"
                :class="log.source === 'bun' ? 'bg-blue-500/10 text-blue-500' : 'bg-emerald-500/10 text-emerald-500'"
              >
                {{ log.source }}
              </span>
              <span class="truncate flex-1 min-w-0">{{ log.message }}</span>
            </div>
            <div v-if="log.args.length > 1" class="mt-1 pl-[7.5rem] text-[var(--ui-text-muted)]">
              <pre class="text-[10px] overflow-auto">{{ formatArgs(log.args.slice(1)) }}</pre>
            </div>
          </div>
          <div v-if="logs.length === 0" class="p-8 text-center text-[var(--ui-text-muted)] text-sm">
            No logs.
          </div>
        </UScrollArea>

        <!-- Pagination -->
        <div class="flex items-center justify-between px-4 py-2 border-t border-[var(--ui-border)]">
          <span class="text-xs text-[var(--ui-text-muted)]">
            {{ total }} logs · page {{ page }} of {{ totalPages }}
          </span>
          <div class="flex items-center gap-1">
            <UButton icon="i-lucide-chevrons-left" variant="ghost" size="xs" :disabled="page <= 1 || loading" @click="firstPage" />
            <UButton icon="i-lucide-chevron-left" variant="ghost" size="xs" :disabled="page <= 1 || loading" @click="prevPage" />
            <UButton icon="i-lucide-chevron-right" variant="ghost" size="xs" :disabled="page >= totalPages || loading" @click="nextPage" />
            <UButton icon="i-lucide-chevrons-right" variant="ghost" size="xs" :disabled="page >= totalPages || loading" @click="lastPage" />
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
