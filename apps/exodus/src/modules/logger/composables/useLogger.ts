import { ref, computed, watch, onMounted, onUnmounted } from "vue"
import { edem } from "@/edem"
import { webviewLogger } from "@/modules/logger/webview"
import type { LogEntry } from "@/modules/logger/types"

const PAGE_SIZE = 100
const COLLECTION_ID = "logs"

function formatTime(ts: number) {
  const d = new Date(ts)
  return d.toLocaleTimeString() + "." + String(d.getMilliseconds()).padStart(3, "0")
}

function matchesFilters(log: LogEntry, level: string, source: string, search: string): boolean {
  if (level !== "all" && log.level !== level) return false
  if (source !== "all" && log.source !== source) return false
  if (search.trim() && !log.message.includes(search.trim())) return false
  return true
}

export function useLogger() {
  const logs = ref<LogEntry[]>([])
  const total = ref(0)
  const levelFilter = ref<string>("all")
  const sourceFilter = ref<string>("all")
  const textFilter = ref("")
  const isPaused = ref(false)
  const offset = ref(0)
  const loading = ref(false)
  const stats = ref({ debug: 0, info: 0, warn: 0, error: 0 })

  let requestId = 0
  const unsubs: (() => void)[] = []
  let statsTimer: ReturnType<typeof setTimeout> | null = null

  async function fetchLogs() {
    if (loading.value) return
    loading.value = true
    const currentRequestId = ++requestId
    try {
      const res = await webviewLogger.query({
        level: levelFilter.value,
        source: sourceFilter.value,
        search: textFilter.value,
        limit: PAGE_SIZE,
        offset: offset.value,
      })
      if (currentRequestId !== requestId) return
      logs.value = res.logs
      total.value = res.total
    } finally {
      if (currentRequestId === requestId) {
        loading.value = false
      }
    }
  }

  async function refreshStats() {
    stats.value = await webviewLogger.stats()
  }

  function debouncedRefreshStats() {
    if (statsTimer) return
    statsTimer = setTimeout(() => {
      statsTimer = null
      refreshStats()
    }, 500)
  }

  function toLogEntry(item: {
    id: string
    created_at: number
    data: Record<string, unknown>
  }): LogEntry {
    return {
      id: item.id,
      timestamp: item.created_at,
      level: item.data.level as LogEntry["level"],
      source: item.data.source as "bun" | "webview",
      message: item.data.message as string,
      args: (item.data.args as unknown[]) ?? [],
      count: item.data.count as number | undefined,
    }
  }

  function subscribe() {
    unsubs.push(
      edem.data.itemCreated(async ({ event: item }) => {
        if (item.collection_id !== COLLECTION_ID) return
        if (isPaused.value) return

        const entry = toLogEntry(item)
        if (matchesFilters(entry, levelFilter.value, sourceFilter.value, textFilter.value)) {
          logs.value = [entry, ...logs.value].slice(0, PAGE_SIZE)
          total.value++
        }
        debouncedRefreshStats()
      }),
    )

    unsubs.push(
      edem.data.itemUpdated(async ({ event: item }) => {
        if (item.collection_id !== COLLECTION_ID) return
        if (isPaused.value) return

        const idx = logs.value.findIndex((l) => l.id === item.id)
        if (idx !== -1) {
          logs.value[idx] = toLogEntry(item)
        }
        debouncedRefreshStats()
      }),
    )

    unsubs.push(
      edem.data.itemDeleted(async ({ event }) => {
        if (isPaused.value) return

        const idx = logs.value.findIndex((l) => l.id === event.item_id)
        if (idx !== -1) {
          logs.value.splice(idx, 1)
          total.value--
        }
        debouncedRefreshStats()
      }),
    )
  }

  watch([levelFilter, sourceFilter, textFilter], () => {
    offset.value = 0
    fetchLogs()
  })

  onMounted(() => {
    fetchLogs()
    refreshStats()
    subscribe()
  })

  onUnmounted(() => {
    for (const unsub of unsubs) unsub()
    unsubs.length = 0
    if (statsTimer) {
      clearTimeout(statsTimer)
      statsTimer = null
    }
  })

  const page = computed(() => Math.floor(offset.value / PAGE_SIZE) + 1)
  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))

  function nextPage() {
    if (offset.value + PAGE_SIZE < total.value) {
      offset.value += PAGE_SIZE
      fetchLogs()
    }
  }

  function prevPage() {
    if (offset.value >= PAGE_SIZE) {
      offset.value -= PAGE_SIZE
      fetchLogs()
    }
  }

  function firstPage() {
    offset.value = 0
    fetchLogs()
  }

  function lastPage() {
    offset.value = Math.max(0, (totalPages.value - 1) * PAGE_SIZE)
    fetchLogs()
  }

  async function clear() {
    await webviewLogger.clear("all")
    offset.value = 0
    await fetchLogs()
    await refreshStats()
  }

  function togglePause() {
    isPaused.value = !isPaused.value
    if (!isPaused.value) {
      fetchLogs()
      refreshStats()
    }
  }

  return {
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
  }
}
