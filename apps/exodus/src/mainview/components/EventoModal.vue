<script setup lang="ts">
import { ref, computed, reactive } from "vue"
import { useRouter } from "vue-router"
import { useEventoDebugger } from "../composables/useEventoDebugger"
import { evento } from "../evento"

const router = useRouter()
const {
  filteredLogs,
  filterName,
  filterSource,
  filterTraceId,
  isPaused,
  stats,
  listeners,
  clearLogs,
  togglePause,
  emitEvent,
} = useEventoDebugger()

const registry = computed(() => listeners.value.registry)

const activeTab = ref<"log" | "listeners" | "playground">("log")

const selectedEvent = ref("")
const eventSchema = ref<{ type: string; properties?: Record<string, { type: string }> } | null>(null)
const eventDescription = ref("")
const formValues = reactive<Record<string, any>>({})
const playgroundResult = ref<string | null>(null)

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

const tabs = [
  { label: "Live Log", value: "log", icon: "i-lucide-activity" },
  { label: "Listeners", value: "listeners", icon: "i-lucide-radio" },
  { label: "Playground", value: "playground", icon: "i-lucide-play" },
] as const
</script>

<template>
  <UModal :open="true" :dismissible="false" fullscreen>
    <template #content>
      <div class="bg-gray-50 dark:bg-gray-950 flex flex-col h-full">
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <div class="flex items-center gap-3">
            <UButton icon="i-lucide-arrow-left" variant="ghost" @click="router.push('/')" />
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

        <!-- Stats -->
        <div class="grid grid-cols-4 gap-px bg-gray-200 dark:bg-gray-800">
          <div class="bg-gray-50 dark:bg-gray-950 px-3 py-2">
            <div class="text-xs text-gray-500">Total Events</div>
            <div class="text-lg font-semibold">{{ stats.total }}</div>
          </div>
          <div class="bg-gray-50 dark:bg-gray-950 px-3 py-2">
            <div class="text-xs text-gray-500">Received</div>
            <div class="text-lg font-semibold">{{ stats.totalReceived }}</div>
          </div>
          <div class="bg-gray-50 dark:bg-gray-950 px-3 py-2">
            <div class="text-xs text-gray-500">Max Depth</div>
            <div class="text-lg font-semibold">{{ stats.maxDepth }}</div>
          </div>
          <div class="bg-gray-50 dark:bg-gray-950 px-3 py-2">
            <div class="text-xs text-gray-500">Top Event</div>
            <div class="text-sm font-semibold truncate">{{ stats.topEvents[0]?.[0] || "—" }}</div>
            <div class="text-xs text-gray-400">{{ stats.topEvents[0]?.[1] || 0 }} hits</div>
          </div>
        </div>

        <!-- Tab Buttons -->
        <div class="flex border-b border-gray-200 dark:border-gray-800">
          <button
            v-for="tab in tabs"
            :key="tab.value"
            class="px-4 py-2 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors"
            :class="activeTab === tab.value 
              ? 'border-primary text-primary' 
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'"
            @click="activeTab = tab.value"
          >
            <span :class="tab.icon" />
            {{ tab.label }}
          </button>
        </div>

        <!-- Tab Content -->
        <div class="flex-1 min-h-0 overflow-hidden">
          <!-- Live Log -->
          <div v-if="activeTab === 'log'" class="h-full flex flex-col">
            <div class="flex flex-wrap gap-2 p-3 border-b border-gray-200 dark:border-gray-800">
              <UInput v-model="filterName" placeholder="Filter name..." class="w-48" />
              <UInput v-model="filterSource" placeholder="Filter source..." class="w-48" />
              <UInput v-model="filterTraceId" placeholder="Filter trace_id..." class="w-64" />
            </div>
            <div class="flex-1 overflow-auto">
              <table class="w-full text-sm">
                <thead class="bg-gray-100 dark:bg-gray-900 sticky top-0">
                  <tr>
                    <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 w-24">Time</th>
                    <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 w-40">Event</th>
                    <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 w-32">Source</th>
                    <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 w-14">Depth</th>
                    <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 w-48">Trace ID</th>
                    <th class="px-3 py-2 text-left text-xs font-medium text-gray-500">Payload</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in logRows" :key="row.id" class="border-b border-gray-100 dark:border-gray-800">
                    <td class="px-3 py-2 text-xs font-mono">{{ row.time }}</td>
                    <td class="px-3 py-2">
                      <code class="text-primary text-xs">{{ row.name }}</code>
                    </td>
                    <td class="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">{{ row.source }}</td>
                    <td class="px-3 py-2 text-xs">{{ row.depth }}</td>
                    <td class="px-3 py-2 text-xs font-mono text-gray-500 truncate max-w-48">{{ row.trace }}</td>
                    <td class="px-3 py-2">
                      <pre class="text-xs bg-gray-100 dark:bg-gray-900 rounded px-2 py-1 max-h-24 overflow-auto">{{ row.payload }}</pre>
                    </td>
                  </tr>
                </tbody>
              </table>
              <div v-if="logRows.length === 0" class="p-8 text-center text-gray-400">
                No events captured yet.
              </div>
            </div>
          </div>

          <!-- Listeners -->
          <div v-else-if="activeTab === 'listeners'" class="h-full overflow-auto p-3 space-y-3">
            <div>
              <h3 class="text-sm font-semibold mb-2 flex items-center gap-2">
                <span class="i-lucide-bookmark text-success" />
                Registered Events ({{ registry.length }})
              </h3>
              <div v-if="registry.length === 0" class="text-gray-400 text-sm">No registered events</div>
              <div v-else class="flex flex-wrap gap-2">
                <UBadge v-for="evt in registry" :key="evt.name" color="neutral" variant="subtle" class="font-mono">
                  {{ evt.name }}
                </UBadge>
              </div>
            </div>
            <div class="grid md:grid-cols-2 gap-3">
              <div>
                <h3 class="text-sm font-semibold mb-2 flex items-center gap-2">
                  <span class="i-lucide-list text-primary" />
                  Exact Listeners ({{ listeners.exact.length }})
                </h3>
                <div v-if="listeners.exact.length === 0" class="text-gray-400 text-sm">No exact listeners</div>
                <ul v-else class="space-y-1">
                  <li v-for="item in listeners.exact" :key="item.name" class="flex items-center justify-between text-sm py-1 border-b border-gray-100 dark:border-gray-800">
                    <code class="text-primary text-xs">{{ item.name }}</code>
                    <UBadge variant="subtle" color="neutral" class="text-xs">{{ item.count }}</UBadge>
                  </li>
                </ul>
              </div>
              <div>
                <h3 class="text-sm font-semibold mb-2 flex items-center gap-2">
                  <span class="i-lucide-asterisk text-warning" />
                  Wildcard Listeners ({{ listeners.wildcards.length }})
                </h3>
                <div v-if="listeners.wildcards.length === 0" class="text-gray-400 text-sm">No wildcard listeners</div>
                <ul v-else class="space-y-1">
                  <li v-for="item in listeners.wildcards" :key="item.pattern" class="flex items-center justify-between text-sm py-1 border-b border-gray-100 dark:border-gray-800">
                    <code class="text-warning text-xs">{{ item.pattern }}</code>
                    <UBadge variant="subtle" color="neutral" class="text-xs">{{ item.count }}</UBadge>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <!-- Playground -->
          <div v-else-if="activeTab === 'playground'" class="h-full grid lg:grid-cols-2 gap-px bg-gray-200 dark:bg-gray-800">
            <!-- Event List -->
            <div class="bg-gray-50 dark:bg-gray-950 flex flex-col h-full">
              <h3 class="text-sm font-semibold px-3 py-2 border-b border-gray-200 dark:border-gray-800">Registered Events</h3>
              <div class="flex-1 overflow-auto p-2 space-y-1">
                <div
                  v-for="evt in registry"
                  :key="evt.name"
                  class="cursor-pointer rounded px-2 py-1.5 text-sm transition-colors"
                  :class="selectedEvent === evt.name 
                    ? 'bg-primary/10 text-primary' 
                    : 'hover:bg-gray-100 dark:hover:bg-gray-900'"
                  @click="selectEvent(evt.name)"
                >
                  <div class="flex items-center justify-between">
                    <code class="font-mono text-xs">{{ evt.name }}</code>
                    <UBadge v-if="evt.description" color="neutral" variant="subtle" class="text-xs">{{ evt.description }}</UBadge>
                  </div>
                </div>
              </div>
            </div>

            <!-- Action Panel -->
            <div class="bg-gray-50 dark:bg-gray-950 flex flex-col h-full">
              <h3 class="text-sm font-semibold px-3 py-2 border-b border-gray-200 dark:border-gray-800">
                {{ selectedEvent ? 'Test Event' : 'Select an event' }}
              </h3>
              <div v-if="selectedEvent" class="flex-1 overflow-auto p-3 space-y-3">
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
              <div v-else class="flex-1 flex items-center justify-center text-gray-400 text-sm">
                Click an event from the list to test it.
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
