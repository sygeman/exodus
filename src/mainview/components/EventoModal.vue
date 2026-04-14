<script setup lang="ts">
import { ref, computed, reactive } from "vue"
import { useI18n } from "vue-i18n"
import { useEventoDebugger } from "@/mainview/composables/useEventoDebugger"
import { evento } from "@/mainview/evento"

const emit = defineEmits<{
  (e: "close"): void
}>()

const {
  filteredLogs,
  isPaused,
  listeners,
  clearLogs,
  togglePause,
  emitEvent,
} = useEventoDebugger()

const registry = computed(() => listeners.value.registry)

const eventFilter = ref("")

const filteredRegistry = computed(() => {
  const q = eventFilter.value.trim().toLowerCase()
  if (!q) return registry.value
  return registry.value.filter(
    (evt: any) =>
      evt.name.toLowerCase().includes(q) ||
      (evt.description && evt.description.toLowerCase().includes(q)),
  )
})

const selectedEvent = ref("")
const eventSchema = ref<{ type: string; properties?: Record<string, { type: string }> } | null>(
  null,
)
const eventDescription = ref("")
const formValues = reactive<Record<string, any>>({})
const playgroundResult = ref<string | null>(null)

const { t } = useI18n()

const selectedLog = ref<(typeof logRows.value)[0] | null>(null)

const logFilter = ref("")

const filteredLogRows = computed(() => {
  const q = logFilter.value.trim().toLowerCase()
  if (!q) return logRows.value
  return logRows.value.filter((row) =>
    [row.time, row.name, row.source, row.depth, row.trace, row.payload]
      .some((field) => String(field).toLowerCase().includes(q)),
  )
})

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
        for (const [key, fieldDef] of Object.entries(
          res.data.schema.properties as Record<string, { type: string }>,
        )) {
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
  playgroundResult.value = `${t("common.emit")}: ${selectedEvent.value}`
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
      <div class="flex flex-col h-full bg-[var(--ui-bg)]">
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-[var(--ui-border)]">
          <div class="flex items-center gap-3">
            <UButton icon="i-lucide-arrow-left" variant="ghost" @click="emit('close')" />
            <h1 class="text-xl font-bold">{{ t('common.events') }}</h1>
            <UBadge v-if="isPaused" color="warning" variant="subtle">{{ t('common.paused') }}</UBadge>
          </div>
          <div class="flex items-center gap-2">
            <UButton
              :color="isPaused ? 'warning' : 'neutral'"
              variant="subtle"
              @click="togglePause"
            >
              {{ isPaused ? t('common.resume') : t('common.pause') }}
            </UButton>
            <UButton color="error" variant="subtle" @click="clearLogs">{{ t('common.clear') }}</UButton>
          </div>
        </div>

        <!-- Main Content -->
        <div class="flex-1 min-h-0 grid grid-cols-2 gap-px bg-[var(--ui-border)]">
          <!-- Left Panel -->
          <div class="bg-[var(--ui-bg)] flex flex-col min-h-0">
            <div class="flex flex-wrap gap-2 px-2 py-1.5 border-b border-[var(--ui-border)]">
              <UInput v-model="eventFilter" :placeholder="t('events.searchEvents')" class="flex-1 min-w-0" />
            </div>

            <UScrollArea class="flex-1 min-h-0">
              <div class="p-2 space-y-1">
                <div
                  v-for="evt in filteredRegistry"
                  :key="evt.name"
                  class="cursor-pointer rounded px-2 py-1.5 text-sm transition-colors flex items-center justify-between"
                  :class="
                    selectedEvent === evt.name
                      ? 'bg-[var(--ui-primary)]/10 text-[var(--ui-primary)]'
                      : 'hover:bg-[var(--ui-bg-elevated)]'
                  "
                  @click="selectEvent(evt.name)"
                >
                  <code class="font-mono text-xs">{{ evt.name }}</code>
                  <UBadge v-if="evt.description" color="neutral" variant="subtle" class="text-xs">
                    {{ evt.description }}
                  </UBadge>
                </div>
              </div>
            </UScrollArea>

            <div class="border-t border-[var(--ui-border)] flex-1 min-h-0">
              <UScrollArea class="h-full">
                <div class="p-3 space-y-3">
                  <template v-if="selectedEvent">
                    <UCard variant="outline">
                      <template #header>
                        <div class="text-xs text-[var(--ui-text-muted)]">{{ t('common.selected') }}</div>
                        <code class="text-sm font-mono text-[var(--ui-primary)]">{{ selectedEvent }}</code>
                      </template>
                      <p v-if="eventDescription" class="text-xs text-[var(--ui-text-muted)]">
                        {{ eventDescription }}
                      </p>
                    </UCard>

                    <div
                      v-if="eventSchema?.type === 'object' && eventSchema.properties"
                      class="space-y-2"
                    >
                      <UFormField
                        v-for="(fieldDef, key) in eventSchema.properties"
                        :key="key"
                        :label="key"
                        class="text-xs"
                      >
                        <UInput v-if="fieldDef.type === 'string'" v-model="formValues[key]" size="sm" />
                        <UInput
                          v-else-if="fieldDef.type === 'number'"
                          v-model="formValues[key]"
                          type="number"
                          size="sm"
                        />
                        <div v-else-if="fieldDef.type === 'boolean'" class="flex items-center gap-2">
                          <USwitch v-model="formValues[key]" />
                          <span class="text-xs text-[var(--ui-text-muted)]">
                            {{ formValues[key] ? "true" : "false" }}
                          </span>
                        </div>
                        <UInput v-else v-model="formValues[key]" size="sm" />
                      </UFormField>
                    </div>

                    <div v-else-if="eventSchema?.type === 'void'" class="text-sm text-[var(--ui-text-muted)]">
                      {{ t('common.noPayload') }}
                    </div>

                    <div v-else class="text-sm text-[var(--ui-text-muted)]">
                      {{ t('common.unknownSchema', { type: eventSchema?.type || 'unknown' }) }}
                    </div>

                    <UButton color="primary" size="sm" @click="handlePlaygroundEmit">{{ t('common.emit') }}</UButton>

                    <UCard v-if="playgroundResult" variant="outline">
                      <template #header>
                        <div class="text-xs text-[var(--ui-text-muted)]">{{ t('common.result') }}</div>
                      </template>
                      <pre class="text-xs overflow-auto">{{ playgroundResult }}</pre>
                    </UCard>
                  </template>
                  <div v-else class="text-[var(--ui-text-muted)] text-sm">
                    {{ t('common.clickToTest') }}
                  </div>
                </div>
              </UScrollArea>
            </div>
          </div>

          <!-- Right Panel -->
          <div class="bg-[var(--ui-bg)] flex flex-col min-h-0">
            <div class="flex gap-2 px-2 py-1.5 border-b border-[var(--ui-border)]">
              <UInput v-model="logFilter" :placeholder="t('events.searchLogs')" class="flex-1 min-w-0" />
            </div>

             <UScrollArea class="flex-1 min-h-0">
               <div
                 v-for="row in filteredLogRows"
                 :key="row.id"
                 class="px-3 py-2 border-b border-[var(--ui-border)] text-xs leading-relaxed cursor-pointer hover:bg-[var(--ui-bg-elevated)]"
                 @click="selectedLog = row"
               >
                 <div class="flex items-center gap-2">
                   <span class="font-mono text-[var(--ui-text-muted)]">{{ row.time }}</span>
                   <code class="text-[var(--ui-primary)] text-sm">{{ row.name }}</code>
                   <span class="text-[var(--ui-text-muted)]">{{ row.source }}</span>
                   <span class="text-[var(--ui-text-muted)]">d{{ row.depth }}</span>
                   <span
                     v-if="row.payload !== 'undefined'"
                     class="text-[var(--ui-text-muted)] truncate flex-1 min-w-0"
                   >
                     {{ row.payload }}
                   </span>
                 </div>
               </div>
                <div v-if="filteredLogRows.length === 0" class="p-4 text-center text-[var(--ui-text-muted)] text-sm">
                  {{ t('common.noEvents') }}
                </div>
             </UScrollArea>
           </div>
         </div>
       </div>
     </template>
   </UModal>

    <UModal
      :open="!!selectedLog"
      @update:open="(v) => { if (!v) selectedLog = null }"
    >
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h2 class="text-lg font-semibold">{{ t('events.eventDetails') }}</h2>
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
              <div class="grid grid-cols-[5rem_1fr] gap-2 items-baseline">
                <span class="text-[var(--ui-text-muted)]">{{ t('common.time') }}</span>
                <span class="font-mono">{{ selectedLog.time }}</span>
              </div>
              <div class="grid grid-cols-[5rem_1fr] gap-2 items-baseline">
                <span class="text-[var(--ui-text-muted)]">{{ t('common.events') }}</span>
                <code class="text-[var(--ui-primary)] font-mono">{{ selectedLog.name }}</code>
              </div>
              <div class="grid grid-cols-[5rem_1fr] gap-2 items-baseline">
                <span class="text-[var(--ui-text-muted)]">{{ t('common.source') }}</span>
                <span>{{ selectedLog.source }}</span>
              </div>
              <div class="grid grid-cols-[5rem_1fr] gap-2 items-baseline">
                <span class="text-[var(--ui-text-muted)]">{{ t('common.depth') }}</span>
                <span>{{ selectedLog.depth }}</span>
              </div>
              <div class="grid grid-cols-[5rem_1fr] gap-2 items-baseline">
                <span class="text-[var(--ui-text-muted)]">{{ t('common.trace') }}</span>
                <span class="font-mono text-[var(--ui-text-muted)] truncate">{{ selectedLog.trace }}</span>
              </div>
              <div v-if="selectedLog.payload !== 'undefined'" class="space-y-1">
                <span class="text-[var(--ui-text-muted)]">{{ t('common.payload') }}</span>
                <pre class="bg-[var(--ui-bg-elevated)] rounded px-3 py-2 overflow-auto text-xs">{{ selectedLog.payload }}</pre>
              </div>
            </div>
          </UScrollArea>
        </UCard>
      </template>
    </UModal>
 </template>
