import { ref, computed, watch, onMounted, onUnmounted } from "vue"
import { webviewLogger } from "@/modules/logger/webview"
import type { LogEntry } from "@/modules/logger/events"

const PAGE_SIZE = 100

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

  let pollInterval: ReturnType<typeof setInterval> | null = null

  function startPolling() {
    if (pollInterval) return
    pollInterval = setInterval(() => {
      if (!isPaused.value) {
        fetchLogs()
        refreshStats()
      }
    }, 1000)
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval)
      pollInterval = null
    }
  }

  watch([levelFilter, sourceFilter, textFilter], () => {
    offset.value = 0
    fetchLogs()
  })

  onMounted(() => {
    fetchLogs()
    refreshStats()
    startPolling()
  })

  onUnmounted(() => {
    stopPolling()
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

  function formatTime(ts: number) {
    const d = new Date(ts)
    return d.toLocaleTimeString() + "." + String(d.getMilliseconds()).padStart(3, "0")
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
