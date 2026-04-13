import { ref, computed } from "vue"
import { evento } from "../evento"

export interface EventoLogEntry {
  id: string
  timestamp: number
  name: string
  payload: unknown
  meta: {
    environment: string
    source: string
    depth: number
    trace_id: string
    timestamp: number
  }
}

const MAX_LOGS = 500
const DISPLAY_LIMIT = 100 // показываем только последние 100 в UI

const logs = ref<EventoLogEntry[]>([])
const filterName = ref("")
const filterSource = ref("")
const filterTraceId = ref("")
const isPaused = ref(false)
const totalReceived = ref(0)

function addLog(name: string, payload: unknown, meta: EventoLogEntry["meta"]) {
  if (isPaused.value) return
  totalReceived.value++
  logs.value.unshift({
    id: `${meta.trace_id}-${totalReceived.value}`,
    timestamp: meta.timestamp,
    name,
    payload,
    meta,
  })
  if (logs.value.length > MAX_LOGS) {
    logs.value.pop()
  }
}

// Global wildcard listener
evento.on("**", (ctx) => {
  addLog(ctx.name, ctx.payload, ctx.meta)
})

export function useEventoDebugger() {
  const filteredLogs = computed(() => {
    const filtered = logs.value.filter((log) => {
      if (filterName.value && !log.name.includes(filterName.value)) return false
      if (filterSource.value && !log.meta.source.includes(filterSource.value)) return false
      if (filterTraceId.value && !log.meta.trace_id.includes(filterTraceId.value)) return false
      return true
    })
    // Ограничиваем отображение для производительности
    return filtered.slice(0, DISPLAY_LIMIT)
  })

  const stats = computed(() => {
    const counts = new Map<string, number>()
    let maxDepth = 0
    for (const log of logs.value) {
      counts.set(log.name, (counts.get(log.name) || 0) + 1)
      if (log.meta.depth > maxDepth) maxDepth = log.meta.depth
    }
    const topEvents = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
    return {
      total: logs.value.length,
      totalReceived: totalReceived.value,
      maxDepth,
      topEvents,
    }
  })

  const listeners = computed(() => evento.getDebugInfo())

  const registeredEvents = computed(() => {
    const info = evento.getDebugInfo()
    const set = new Set<string>()
    for (const item of info.exact) {
      set.add(item.name)
    }
    for (const item of info.wildcards) {
      set.add(item.pattern)
    }
    return Array.from(set).sort()
  })

  function clearLogs() {
    logs.value = []
    totalReceived.value = 0
  }

  function togglePause() {
    isPaused.value = !isPaused.value
  }

  function emitEvent(name: string, payload: string, source: string) {
    let parsed: unknown = undefined
    if (payload.trim()) {
      try {
        parsed = JSON.parse(payload)
      } catch {
        parsed = payload
      }
    }
    if (parsed === undefined) {
      ;(evento as any).emitEvent(name, source)
    } else {
      ;(evento as any).emitEvent(name, parsed, source)
    }
  }

  async function sendRequest(
    name: string,
    payload: string,
    timeout: number,
  ): Promise<{ success: boolean; data: string; correlation_id: string }> {
    let parsed: unknown = undefined
    if (payload.trim()) {
      try {
        parsed = JSON.parse(payload)
      } catch {
        parsed = payload
      }
    }
    const response = await (evento as any).request(name, parsed, { timeout })
    return {
      success: true,
      data: JSON.stringify(response.data, null, 2),
      correlation_id: response.correlation_id,
    }
  }

  return {
    logs,
    filteredLogs,
    filterName,
    filterSource,
    filterTraceId,
    isPaused,
    stats,
    listeners,
    registeredEvents,
    clearLogs,
    togglePause,
    emitEvent,
    sendRequest,
  }
}
