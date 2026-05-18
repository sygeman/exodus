<script setup lang="ts">
import { useT } from "@/composables/useT"

const t = useT()

function formatTime(ts: number | string | Date): string {
  const d = new Date(ts)
  return d.toLocaleTimeString()
}

// TODO: implement levelBadgeColor

// TODO: implement t

import { computed, ref } from "vue"
import { useLogs } from "@/hooks"
import { edem } from "@/edem"

const PAGE_SIZE = 100
const offset = ref(0)
const levelFilter = ref("all")
const sourceFilter = ref("all")
const textFilter = ref("")

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

const { items: logs, total, loading, refetch } = useLogs(options)

const page = computed(() => Math.floor(offset.value / PAGE_SIZE) + 1)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))

function nextPage() {
  if (offset.value + PAGE_SIZE < total.value) offset.value += PAGE_SIZE
}
function prevPage() {
  if (offset.value >= PAGE_SIZE) offset.value -= PAGE_SIZE
}
function firstPage() {
  offset.value = 0
}
function lastPage() {
  offset.value = Math.max(0, (totalPages.value - 1) * PAGE_SIZE)
}

async function clear() {
  await edem.data.deleteItemsByFilter({ collection_id: "logs", filter: {} })
  offset.value = 0
  await refetch()
}

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

const levelOptions = computed(() => [
  { label: "All", value: "all" },
  { label: "Debug", value: "debug" },
  { label: "Info", value: "info" },
  { label: "Warn", value: "warn" },
  { label: "Error", value: "error" },
])

const sourceOptions = computed(() => [
  { label: "All", value: "all" },
  { label: "Bun", value: "bun" },
  { label: "Webview", value: "webview" },
])
</script>

<template>
  <div class="bg-default flex h-full flex-col">
    <div class="border-default flex items-center justify-between border-b px-4 py-3">
      <div class="flex items-center gap-3">
        <h1 class="text-xl font-bold">{{ t({ en: "Logs", ru: "Логи" }) }}</h1>
      </div>
      <div class="flex items-center gap-2">
        <UButton color="error" variant="subtle">{{ t({ en: "Clear", ru: "Очистить" }) }}</UButton>
      </div>
    </div>
    <div class="border-default flex flex-wrap gap-2 border-b px-4 py-2">
      <USelectMenu
        :model-value="levelFilter"
        :items="levelOptions"
        value-key="value"
        class="w-28"
      />
      <USelectMenu
        :model-value="sourceFilter"
        :items="sourceOptions"
        value-key="value"
        class="w-28"
      />
      <UInput
        :model-value="textFilter"
        :placeholder="t({ en: 'Search logs', ru: 'Поиск логов' })"
        class="min-w-0 flex-1"
      />
    </div>
    <UScrollArea class="min-h-0 flex-1" v-for="item in logs" :key="item.id">
      <div
        class="group border-default hover:bg-elevated border-b px-4 py-2 text-xs leading-relaxed"
      >
        <div class="group flex items-center gap-2">
          <span class="text-muted font-mono">{{ formatTime(item.created_at) }}</span>
          <UBadge
            :color="levelBadgeColor(item.data.level)"
            variant="subtle"
            class="text-[10px] uppercase"
            >{{ item.data.level }}</UBadge
          >
          <span class="min-w-0 flex-1 truncate">{{ item.data.message }}</span>
        </div>
      </div>
    </UScrollArea>
    <div class="border-default flex items-center justify-between border-t px-4 py-2">
      <span class="text-muted text-xs">{{
        t({ en: "{total} logs", ru: "{total} логов" }, { total })
      }}</span>
      <div class="flex items-center gap-1">
        <UButton icon="i-lucide-chevrons-left" variant="ghost" size="xs" />
        <UButton icon="i-lucide-chevron-left" variant="ghost" size="xs" />
        <UButton icon="i-lucide-chevron-right" variant="ghost" size="xs" />
        <UButton icon="i-lucide-chevrons-right" variant="ghost" size="xs" />
      </div>
    </div>
  </div>
</template>
