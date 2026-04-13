<script setup lang="ts">
import { ref, computed, reactive } from "vue"
import { useEventoDebugger } from "../composables/useEventoDebugger"
import { evento } from "../evento"

const emit = defineEmits<{
  (e: "close"): void
}>()

const {
  filteredLogs,
  filterName,
  filterSource,
  filterTraceId,
  isPaused,
  listeners,
  clearLogs,
  togglePause,
  emitEvent,
} = useEventoDebugger()

const registry = computed(() => listeners.value.registry)

const selectedEvent = ref("")
const eventSchema = ref<{ type: string; properties?: Record<string, { type: string }> } | null>(null)
const eventDescription = ref("")
const formValues = reactive<Record<string, any>>({})
const playgroundResult = ref<string | null>(null)

const selectedLog = ref<typeof logRows.value[0] | null>(null)

async function selectEvent(name: string) {
  selectedEvent.value = name
  eventSchema.value = null
  eventDescription.value = ""
  playgroundResult.value = null
  Object.keys(formValues).forEach((key) => delete formValues[key])

  try {
    const res = await (evento as any).request("evento:schema:request", { name }, { timeout: 2000 })
    if (res.data?.schema) {
      eventSchema.value = res.data.schema
      eventDescription.value = res.data.description || ""
      if (res.data.schema.type === "object" && res.data.schema.properties) {
        for (const [key, fieldDef] of Object.entries(res.data.schema.properties as Record<string, { type: string }>)) {
          formValues[key] = fieldDef.type === "boolean" ? false : ""
        }
      }
    }
  } catch (e) {
    console.error("[webview] Failed to get schema:", e)
  }
}

function buildPayload(): unknown {
  if (!eventSchema.value) return undefined
  if (eventSchema.value.type === "void") return undefined
  if (eventSchema.value.type === "object" && eventSchema.value.properties) {
    const payload: Record<string, any> = {}
    for (const [key, value] of Object.entries(formValues)) {
      const fieldDef = eventSchema.value.properties[key]
      if (fieldDef?.type === "number") {
        payload[key] = Number(value) || 0
      } else if (fieldDef?.type === "boolean") {
        payload[key] = Boolean(value)
      } else {
        payload[key] = value
      }
    }
    return payload
  }
  return undefined
}

async function handlePlaygroundEmit() {
  const payload = buildPayload()
  emitEvent(selectedEvent.value, payload ? JSON.stringify(payload) : "", "user:playground")
  playgroundResult.value = `Emitted: ${selectedEvent.value}`
}

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
  <UModal :open="true" :dismissible="false" fullscreen @after-leave="emit('close')">
    <template #content>
      <div class="bg-gray-50 dark:bg-gray-950 flex flex-col h-full">
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <div class="flex items-center gap-3">
            <UButton icon="i-lucide-arrow-left" variant="ghost" @click="emit('close')" />
            <h1 class="text-xl font-bold">Evento Debug</h1>
            <UBadge v-if="isPaused" color="warning" variant="subtle">Paused</UBadge>
          </div>
          <div class="flex items-center gap-2">
            <UButton :color="isPaused ? 'warning' : 'neutral'" variant="subtle" @click="togglePause">
              {{ isPaused ? "Resume" : "Pause" }}
            </UButton>
            <UButton color="error" variant="subtle" @click="clearLogs">Clear</UButton>
          </div>
        </div>

        <!-- Main Content: Left = Schema/Playground, Right = Live Log -->
        <div class="flex-1 min-h-0 grid grid-cols-2 gap-px bg-gray-200 dark:bg-gray-800">
          
          <!-- Left Panel -->
          <div class="bg-gray-50 dark:bg-gray-950 flex flex-col h-full overflow-hidden">
            <div class="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-800">
              Playground
            </div>
            
            <!-- Registered Events List -->
            <div class="flex-1 overflow-auto border-b border-gray-200 dark:border-gray-800 p-2 space-y-1">
              <div
                v-for="evt in registry"
                :key="evt.name"
                class="cursor-pointer rounded px-2 py-1.5 text-sm transition-colors flex items-center justify-between"
                :class="selectedEvent === evt.name
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-900'"
                @click="selectEvent(evt.name)"
              >
                <code class="font-mono text-xs">{{ evt.name }}</code>
                <UBadge v-if="evt.description" color="neutral" variant="subtle" class="text-xs">{{ evt.description }}</UBadge>
              </div>
            </div>

            <!-- Playground / Selected Event -->
            <div class="flex-1 overflow-auto p-3 space-y-3 border-t border-gray-200 dark:border-gray-800">
              <div v-if="selectedEvent" class="space-y-3">
                <div class="rounded bg-gray-100 dark:bg-gray-900 px-3 py-2">
                  <div class="text-xs text-gray-500">Selected</div>
                  <code class="text-sm font-mono text-primary">{{ selectedEvent }}</code>
                  <div v-if="eventDescription" class="text-xs text-gray-400 mt-1">{{ eventDescription }}</div>
                </div>

                <div v-if="eventSchema?.type === 'object' && eventSchema.properties" class="space-y-2">
                  <UFormField v-for="(fieldDef, key) in eventSchema.properties" :key="key" :label="key" class="text-xs">
                    <UInput v-if="fieldDef.type === 'string'" v-model="formValues[key]" size="sm" />
                    <UInput v-else-if="fieldDef.type === 'number'" v-model="formValues[key]" type="number" size="sm" />
                    <div v-else-if="fieldDef.type === 'boolean'" class="flex items-center gap-2">
                      <USwitch v-model="formValues[key]" />
                      <span class="text-xs text-gray-600">{{ formValues[key] ? 'true' : 'false' }}</span>
                    </div>
                    <UInput v-else v-model="formValues[key]" size="sm" />
                  </UFormField>
                </div>

                <div v-else-if="eventSchema?.type === 'void'" class="text-sm text-gray-500">
                  No payload required (void)
                </div>

                <div v-else class="text-sm text-gray-500">
                  Schema: {{ eventSchema?.type || 'unknown' }}
                </div>

                <UButton color="primary" size="sm" @click="handlePlaygroundEmit">Emit</UButton>

                <div v-if="playgroundResult">
                  <div class="text-xs text-gray-500 mb-1">Result</div>
                  <pre class="text-xs bg-gray-100 dark:bg-gray-900 rounded px-2 py-1 overflow-auto">{{ playgroundResult }}</pre>
                </div>
              </div>
              <div v-else class="text-gray-400 text-sm">
                Click an event above to test it.
              </div>
            </div>
          </div>

          <!-- Right Panel: Live Log -->
          <div class="bg-gray-50 dark:bg-gray-950 flex flex-col h-full overflow-hidden">
            <div class="flex flex-wrap gap-2 px-2 py-1.5 border-b border-gray-200 dark:border-gray-800">
              <UInput v-model="filterName" placeholder="event" class="w-24" size="xs" />
              <UInput v-model="filterSource" placeholder="src" class="w-20" size="xs" />
              <UInput v-model="filterTraceId" placeholder="trace" class="w-24" size="xs" />
            </div>
            <!-- Log List -->
            <div class="flex-1 overflow-auto">
              <div
                v-for="row in logRows"
                :key="row.id"
                class="px-3 py-2 border-b border-gray-100 dark:border-gray-800 text-xs leading-relaxed cursor-pointer"
                :class="selectedLog?.id === row.id ? 'bg-primary/10' : 'hover:bg-gray-100 dark:hover:bg-gray-900'"
                @click="selectedLog = selectedLog?.id === row.id ? null : row"
              >
                <div class="flex items-center gap-2">
                  <span class="font-mono text-gray-500">{{ row.time }}</span>
                  <code class="text-primary text-sm">{{ row.name }}</code>
                  <span class="text-gray-400">{{ row.source }}</span>
                  <span class="text-gray-500">d{{ row.depth }}</span>
                  <span v-if="row.payload !== 'undefined'" class="text-gray-600 dark:text-gray-400 truncate flex-1 min-w-0">{{ row.payload }}</span>
                </div>
              </div>
              <div v-if="logRows.length === 0" class="p-4 text-center text-gray-400 text-sm">
                No events.
              </div>
            </div>

            <!-- Selected Log Details -->
            <div v-if="selectedLog" class="border-t border-gray-200 dark:border-gray-800 p-3 bg-gray-100 dark:bg-gray-900">
              <div class="flex items-center justify-between mb-2">
                <div class="text-xs font-semibold text-gray-500">Selected Event</div>
                <UButton icon="i-lucide-x" variant="ghost" color="neutral" size="xs" @click="selectedLog = null" />
              </div>
              <div class="space-y-1 text-xs">
                <div class="flex gap-2">
                  <span class="text-gray-500">Time:</span>
                  <span class="font-mono">{{ selectedLog.time }}</span>
                </div>
                <div class="flex gap-2">
                  <span class="text-gray-500">Event:</span>
                  <code class="text-primary">{{ selectedLog.name }}</code>
                </div>
                <div class="flex gap-2">
                  <span class="text-gray-500">Source:</span>
                  <span>{{ selectedLog.source }}</span>
                </div>
                <div class="flex gap-2">
                  <span class="text-gray-500">Depth:</span>
                  <span>{{ selectedLog.depth }}</span>
                </div>
                <div class="flex gap-2">
                  <span class="text-gray-500">Trace:</span>
                  <span class="font-mono text-gray-600 truncate">{{ selectedLog.trace }}</span>
                </div>
                <div v-if="selectedLog.payload !== 'undefined'">
                  <span class="text-gray-500">Payload:</span>
                  <pre class="mt-1 bg-white dark:bg-gray-800 rounded px-2 py-1 max-h-32 overflow-auto">{{ selectedLog.payload }}</pre>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </template>
  </UModal>
</template>
