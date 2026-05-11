<script setup lang="ts">
import { computed, ref, onMounted } from "vue"
import { useT } from "@exodus/edem-vue"
import { useCollectionQuery } from "@/hooks"
import { queryLogStats, clearLogs } from "@/platform/logger"

const t = useT()

const PAGE_SIZE = 100
const offset = ref(0)
const levelFilter = ref("all")
const sourceFilter = ref("all")
const textFilter = ref("")
const stats = ref({ debug: 0, info: 0, warn: 0, error: 0 })

const options = computed(() => {
  const filter: Record<string, unknown> = {}
  if (levelFilter.value !== "all") filter.level = { _eq: levelFilter.value }
  if (sourceFilter.value !== "all") filter.source = { _eq: sourceFilter.value }
  if (textFilter.value.trim()) filter.message = { _contains: textFilter.value.trim() }
  return {
    filter: Object.keys(filter).length > 0 ? filter : undefined,
    sort: ["-created_at"],
    limit: PAGE_SIZE,
    offset: offset.value,
  }
})

const { data: logs, total, loading, refetch } = useCollectionQuery("logs", options)

const page = computed(() => Math.floor(offset.value / PAGE_SIZE) + 1)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))

function nextPage() {
  if (offset.value + PAGE_SIZE < total.value) {
    offset.value += PAGE_SIZE
  }
}

function prevPage() {
  if (offset.value >= PAGE_SIZE) {
    offset.value -= PAGE_SIZE
  }
}

function firstPage() {
  offset.value = 0
}

function lastPage() {
  offset.value = Math.max(0, (totalPages.value - 1) * PAGE_SIZE)
}

async function refreshStats() {
  stats.value = await queryLogStats()
}

async function clear() {
  await clearLogs()
  offset.value = 0
  await refetch()
  await refreshStats()
}

onMounted(() => {
  refreshStats()
})

function formatTime(ts: number) {
  const d = new Date(ts)
  return d.toLocaleTimeString() + "." + String(d.getMilliseconds()).padStart(3, "0")
}

function formatArgs(args: unknown[]) {
  if (!args.length) return ""
  return args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ")
}

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

const copiedLogId = ref<string | null>(null)
let copiedTimeout: ReturnType<typeof setTimeout> | null = null

function copyLog(log: (typeof logs.value)[0]) {
  const text = [
    formatTime(log.created_at),
    log.data.level,
    log.data.source,
    log.data.message,
    log.data.count ? `(+${log.data.count})` : "",
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
  { label: t({ en: "All", ru: "Все" }), value: "all" },
  { label: t({ en: "Debug", ru: "Отладка" }), value: "debug" },
  { label: t({ en: "Info", ru: "Информация" }), value: "info" },
  { label: t({ en: "Warn", ru: "Предупреждение" }), value: "warn" },
  { label: t({ en: "Error", ru: "Ошибка" }), value: "error" },
])

const sourceOptions = computed<{ label: string; value: string }[]>(() => [
  { label: t({ en: "All", ru: "Все" }), value: "all" },
  { label: "Bun", value: "bun" },
  { label: "Webview", value: "webview" },
])
</script>

<template>
  <div class="bg-default flex h-full flex-col">
    <!-- Header -->
    <div class="border-default flex items-center justify-between border-b px-4 py-3">
      <div class="flex items-center gap-3">
        <h1 class="text-xl font-bold">{{ t({ en: "Logs", ru: "Логи" }) }}</h1>
      </div>
      <div class="flex items-center gap-2">
        <div class="text-muted mr-2 hidden items-center gap-3 text-xs sm:flex">
          <div class="flex items-center gap-1">
            <span class="text-dimmed">{{ t({ en: "Debug", ru: "Отладка" }) }}</span>
            <span class="font-medium tabular-nums">{{ stats.debug }}</span>
          </div>
          <div class="flex items-center gap-1">
            <span class="text-dimmed">{{ t({ en: "Info", ru: "Информация" }) }}</span>
            <span class="font-medium tabular-nums">{{ stats.info }}</span>
          </div>
          <div class="flex items-center gap-1">
            <span class="text-dimmed">{{ t({ en: "Warn", ru: "Предупреждение" }) }}</span>
            <span class="font-medium tabular-nums">{{ stats.warn }}</span>
          </div>
          <div class="flex items-center gap-1">
            <span class="text-dimmed">{{ t({ en: "Error", ru: "Ошибка" }) }}</span>
            <span class="font-medium tabular-nums">{{ stats.error }}</span>
          </div>
        </div>
        <UButton color="error" variant="subtle" @click="clear">
          {{ t({ en: "Clear", ru: "Очистить" }) }}
        </UButton>
      </div>
    </div>

    <!-- Filters -->
    <div class="border-default flex flex-wrap gap-2 border-b px-4 py-2">
      <USelectMenu v-model="levelFilter" :items="levelOptions" value-key="value" class="w-28" />
      <USelectMenu v-model="sourceFilter" :items="sourceOptions" value-key="value" class="w-28" />
      <UInput
        v-model="textFilter"
        :placeholder="t({ en: 'Search logs', ru: 'Поиск логов' })"
        class="min-w-0 flex-1"
      />
    </div>

    <!-- Logs list -->
    <UScrollArea class="min-h-0 flex-1">
      <div
        v-for="log in logs"
        :key="log.id"
        class="group border-default hover:bg-elevated border-b px-4 py-2 text-xs leading-relaxed"
      >
        <div class="group flex items-center gap-2">
          <span class="text-muted font-mono">{{ formatTime(log.created_at) }}</span>
          <UBadge
            :color="levelBadgeColor(log.data.level)"
            variant="subtle"
            class="text-[10px] uppercase"
          >
            {{ log.data.level }}
          </UBadge>
          <span
            class="rounded px-1.5 py-0.5 text-[10px] uppercase"
            :class="
              log.data.source === 'bun'
                ? 'bg-blue-500/10 text-blue-500'
                : 'bg-emerald-500/10 text-emerald-500'
            "
          >
            {{ log.data.source }}
          </span>
          <span class="min-w-0 flex-1 truncate">{{ log.data.message }}</span>
          <UBadge
            v-if="log.data.count && log.data.count > 0"
            color="neutral"
            variant="subtle"
            class="text-[10px]"
          >
            +{{ log.data.count }}
          </UBadge>
          <UTooltip
            :text="
              copiedLogId === log.id
                ? t({ en: 'Copied', ru: 'Скопировано' })
                : t({ en: 'Copy', ru: 'Копировать' })
            "
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
        <div
          v-if="log.data.args && (log.data.args as unknown[]).length > 1"
          class="text-muted mt-1 pl-30"
        >
          <pre class="overflow-auto text-[10px]">{{
            formatArgs((log.data.args as unknown[]).slice(1))
          }}</pre>
        </div>
      </div>
      <div v-if="logs.length === 0" class="text-muted p-8 text-center text-sm">
        {{ t({ en: "No logs.", ru: "Нет логов." }) }}
      </div>
    </UScrollArea>

    <!-- Pagination -->
    <div class="border-default flex items-center justify-between border-t px-4 py-2">
      <span class="text-muted text-xs">
        {{ t({ en: "{total} logs", ru: "{total} логов" }, { total }) }}
        ·
        {{
          t(
            { en: "page {page} of {totalPages}", ru: "страница {page} из {totalPages}" },
            { page, totalPages },
          )
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
