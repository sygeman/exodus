<script setup lang="ts">
import { computed, ref } from "vue"
import { useI18n } from "vue-i18n"
import { useLogger } from "@/modules/logger/composables/useLogger"

const { t } = useI18n()

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

const copiedLogId = ref<string | null>(null)
let copiedTimeout: ReturnType<typeof setTimeout> | null = null

function copyLog(log: (typeof logs.value)[0]) {
  const text = [
    formatTime(log.timestamp),
    log.level,
    log.source,
    log.message,
    log.count ? `(+${log.count})` : "",
  ]
    .filter(Boolean)
    .join(" ")
  navigator.clipboard.writeText(text)
  copiedLogId.value = log.id
  if (copiedTimeout) clearTimeout(copiedTimeout)
  copiedTimeout = setTimeout(() => {
    copiedLogId.value = null
  }, 1500)
}

const levelOptions = computed<{ label: string; value: string }[]>(() => [
  { label: t("common.all"), value: "all" },
  { label: t("common.debug"), value: "debug" },
  { label: t("common.info"), value: "info" },
  { label: t("common.warn"), value: "warn" },
  { label: t("common.error"), value: "error" },
])

const sourceOptions = computed<{ label: string; value: string }[]>(() => [
  { label: t("common.all"), value: "all" },
  { label: t("common.bun"), value: "bun" },
  { label: t("common.webview"), value: "webview" },
])

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
  return args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ")
}
</script>

<template>
  <div class="flex h-full flex-col bg-[var(--ui-bg)]">
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-[var(--ui-border)] px-4 py-3">
      <div class="flex items-center gap-3">
        <h1 class="text-xl font-bold">{{ t("common.logs") }}</h1>
        <UBadge v-if="isPaused" color="warning" variant="subtle">{{ t("common.paused") }}</UBadge>
      </div>
      <div class="flex items-center gap-2">
        <div class="mr-2 hidden items-center gap-3 text-xs text-[var(--ui-text-muted)] sm:flex">
          <div class="flex items-center gap-1">
            <span class="text-[var(--ui-text-dimmed)]">{{ t("common.debug") }}</span>
            <span class="font-medium tabular-nums">{{ stats.debug }}</span>
          </div>
          <div class="flex items-center gap-1">
            <span class="text-[var(--ui-text-dimmed)]">{{ t("common.info") }}</span>
            <span class="font-medium tabular-nums">{{ stats.info }}</span>
          </div>
          <div class="flex items-center gap-1">
            <span class="text-[var(--ui-text-dimmed)]">{{ t("common.warn") }}</span>
            <span class="font-medium tabular-nums">{{ stats.warn }}</span>
          </div>
          <div class="flex items-center gap-1">
            <span class="text-[var(--ui-text-dimmed)]">{{ t("common.error") }}</span>
            <span class="font-medium tabular-nums">{{ stats.error }}</span>
          </div>
        </div>
        <UButton :color="isPaused ? 'warning' : 'neutral'" variant="subtle" @click="togglePause">
          {{ isPaused ? t("common.resume") : t("common.pause") }}
        </UButton>
        <UButton color="error" variant="subtle" @click="clear">{{ t("common.clear") }}</UButton>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap gap-2 border-b border-[var(--ui-border)] px-4 py-2">
      <USelectMenu v-model="levelFilter" :items="levelOptions" value-key="value" class="w-28" />
      <USelectMenu v-model="sourceFilter" :items="sourceOptions" value-key="value" class="w-28" />
      <UInput v-model="textFilter" :placeholder="t('debug.searchLogs')" class="min-w-0 flex-1" />
    </div>

    <!-- Logs list -->
    <UScrollArea class="min-h-0 flex-1">
      <div
        v-for="log in logs"
        :key="log.id"
        class="group border-b border-[var(--ui-border)] px-4 py-2 text-xs leading-relaxed hover:bg-[var(--ui-bg-elevated)]"
      >
        <div class="group flex items-center gap-2">
          <span class="font-mono text-[var(--ui-text-muted)]">{{ formatTime(log.timestamp) }}</span>
          <UBadge
            :color="levelBadgeColor(log.level)"
            variant="subtle"
            class="text-[10px] uppercase"
          >
            {{ log.level }}
          </UBadge>
          <span
            class="rounded px-1.5 py-0.5 text-[10px] uppercase"
            :class="
              log.source === 'bun'
                ? 'bg-blue-500/10 text-blue-500'
                : 'bg-emerald-500/10 text-emerald-500'
            "
          >
            {{ log.source }}
          </span>
          <span class="min-w-0 flex-1 truncate">{{ log.message }}</span>
          <UBadge
            v-if="log.count && log.count > 0"
            color="neutral"
            variant="subtle"
            class="text-[10px]"
          >
            +{{ log.count }}
          </UBadge>
          <UTooltip
            :text="copiedLogId === log.id ? t('common.copied') : t('common.copy')"
            :open="copiedLogId === log.id"
            :delay-duration="0"
          >
            <UButton
              :icon="copiedLogId === log.id ? 'i-lucide-check' : 'i-lucide-copy'"
              :color="copiedLogId === log.id ? 'success' : 'neutral'"
              variant="ghost"
              size="xs"
              class="opacity-0 transition-opacity group-hover:opacity-100"
              @click="copyLog(log)"
            />
          </UTooltip>
        </div>
        <div v-if="log.args.length > 1" class="mt-1 pl-[7.5rem] text-[var(--ui-text-muted)]">
          <pre class="overflow-auto text-[10px]">{{ formatArgs(log.args.slice(1)) }}</pre>
        </div>
      </div>
      <div v-if="logs.length === 0" class="p-8 text-center text-sm text-[var(--ui-text-muted)]">
        {{ t("common.noLogs") }}
      </div>
    </UScrollArea>

    <!-- Pagination -->
    <div class="flex items-center justify-between border-t border-[var(--ui-border)] px-4 py-2">
      <span class="text-xs text-[var(--ui-text-muted)]">
        {{
          t("debug.totalLogs", {
            total,
            pageInfo: t("debug.pageOf", { page, totalPages }),
          })
        }}
      </span>
      <div class="flex items-center gap-1">
        <UButton
          icon="i-lucide-chevrons-left"
          variant="ghost"
          size="xs"
          :disabled="page <= 1 || loading"
          @click="firstPage"
        />
        <UButton
          icon="i-lucide-chevron-left"
          variant="ghost"
          size="xs"
          :disabled="page <= 1 || loading"
          @click="prevPage"
        />
        <UButton
          icon="i-lucide-chevron-right"
          variant="ghost"
          size="xs"
          :disabled="page >= totalPages || loading"
          @click="nextPage"
        />
        <UButton
          icon="i-lucide-chevrons-right"
          variant="ghost"
          size="xs"
          :disabled="page >= totalPages || loading"
          @click="lastPage"
        />
      </div>
    </div>
  </div>
</template>
