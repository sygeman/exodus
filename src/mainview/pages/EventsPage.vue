<script setup lang="ts">
import { ref, computed, reactive } from "vue"
import { useI18n } from "vue-i18n"
import { useEventoDebugger } from "@/mainview/composables/useEventoDebugger"
import { evento } from "@/mainview/evento"

const { filteredLogs, isPaused, listeners, clearLogs, togglePause, emitEvent } = useEventoDebugger()

const registry = computed(() => listeners.value.registry)

const eventFilter = ref("")

const filteredRegistry = computed(() => {
  const q = eventFilter.value.trim().toLowerCase()
  if (!q) return registry.value
  return registry.value.filter(
    (evt) =>
      evt.name.toLowerCase().includes(q) ||
      (evt.description && evt.description.toLowerCase().includes(q)),
  )
})

const selectedEvent = ref("")
const eventSchema = ref<{
  type: string
  properties?: Record<string, { type: string }>
} | null>(null)
const eventDescription = ref("")
const formValues = reactive<Record<string, unknown>>({})
const playgroundResult = ref<string | null>(null)

const { t } = useI18n()

const selectedLog = ref<(typeof logRows.value)[0] | null>(null)

const logFilter = ref("")

const filteredLogRows = computed(() => {
  const q = logFilter.value.trim().toLowerCase()
  if (!q) return logRows.value
  return logRows.value.filter((row) =>
    [row.time, row.name, row.source, row.depth, row.trace, row.payload].some((field) =>
      String(field).toLowerCase().includes(q),
    ),
  )
})

async function selectEvent(name: string) {
  selectedEvent.value = name
  eventSchema.value = null
  eventDescription.value = ""
  playgroundResult.value = null
  Object.keys(formValues).forEach((key) => delete formValues[key])

  try {
    const res = await evento.request<
      { name: string },
      {
        schema: { type: string; properties?: Record<string, { type: string }> }
        description?: string
      }
    >("evento:schema:request", { name }, { timeout: 2000 })
    if (res.data?.schema) {
      eventSchema.value = res.data.schema
      eventDescription.value = res.data.description || ""
      if (res.data.schema.type === "object" && res.data.schema.properties) {
        for (const [key, fieldDef] of Object.entries(res.data.schema.properties)) {
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
    const payload: Record<string, unknown> = {}
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
  <div class="flex h-full flex-col bg-[var(--ui-bg)]">
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-[var(--ui-border)] px-4 py-3">
      <div class="flex items-center gap-3">
        <h1 class="text-xl font-bold">{{ t("common.events") }}</h1>
        <UBadge v-if="isPaused" color="warning" variant="subtle">{{ t("common.paused") }}</UBadge>
      </div>
      <div class="flex items-center gap-2">
        <UButton :color="isPaused ? 'warning' : 'neutral'" variant="subtle" @click="togglePause">
          {{ isPaused ? t("common.resume") : t("common.pause") }}
        </UButton>
        <UButton color="error" variant="subtle" @click="clearLogs">{{ t("common.clear") }}</UButton>
      </div>
    </div>

    <!-- Main Content -->
    <div class="grid min-h-0 flex-1 grid-cols-2 gap-px bg-[var(--ui-border)]">
      <!-- Left Panel -->
      <div class="flex min-h-0 flex-col bg-[var(--ui-bg)]">
        <div class="flex flex-wrap gap-2 border-b border-[var(--ui-border)] px-2 py-1.5">
          <UInput
            v-model="eventFilter"
            :placeholder="t('events.searchEvents')"
            class="min-w-0 flex-1"
          />
        </div>

        <UScrollArea class="min-h-0 flex-1">
          <div class="space-y-1 p-2">
            <div
              v-for="evt in filteredRegistry"
              :key="evt.name"
              class="flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-sm transition-colors"
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

        <div class="min-h-0 flex-1 border-t border-[var(--ui-border)]">
          <UScrollArea class="h-full">
            <div class="space-y-3 p-3">
              <template v-if="selectedEvent">
                <UCard variant="outline">
                  <template #header>
                    <div class="text-xs text-[var(--ui-text-muted)]">
                      {{ t("common.selected") }}
                    </div>
                    <code class="font-mono text-sm text-[var(--ui-primary)]">{{
                      selectedEvent
                    }}</code>
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
                    <UInput
                      v-if="fieldDef.type === 'string'"
                      :model-value="String(formValues[key] ?? '')"
                      @update:model-value="(v) => (formValues[key] = v)"
                      size="sm"
                    />
                    <UInput
                      v-else-if="fieldDef.type === 'number'"
                      :model-value="String(formValues[key] ?? '')"
                      @update:model-value="(v) => (formValues[key] = v)"
                      type="number"
                      size="sm"
                    />
                    <div v-else-if="fieldDef.type === 'boolean'" class="flex items-center gap-2">
                      <USwitch
                        :model-value="Boolean(formValues[key])"
                        @update:model-value="(v) => (formValues[key] = v)"
                      />
                      <span class="text-xs text-[var(--ui-text-muted)]">
                        {{ formValues[key] ? "true" : "false" }}
                      </span>
                    </div>
                    <UInput
                      v-else
                      :model-value="String(formValues[key] ?? '')"
                      @update:model-value="(v) => (formValues[key] = v)"
                      size="sm"
                    />
                  </UFormField>
                </div>

                <div
                  v-else-if="eventSchema?.type === 'void'"
                  class="text-sm text-[var(--ui-text-muted)]"
                >
                  {{ t("common.noPayload") }}
                </div>

                <div v-else class="text-sm text-[var(--ui-text-muted)]">
                  {{
                    t("common.unknownSchema", {
                      type: eventSchema?.type || "unknown",
                    })
                  }}
                </div>

                <UButton color="primary" size="sm" @click="handlePlaygroundEmit">{{
                  t("common.emit")
                }}</UButton>

                <UCard v-if="playgroundResult" variant="outline">
                  <template #header>
                    <div class="text-xs text-[var(--ui-text-muted)]">
                      {{ t("common.result") }}
                    </div>
                  </template>
                  <pre class="overflow-auto text-xs">{{ playgroundResult }}</pre>
                </UCard>
              </template>
              <div v-else class="text-sm text-[var(--ui-text-muted)]">
                {{ t("common.clickToTest") }}
              </div>
            </div>
          </UScrollArea>
        </div>
      </div>

      <!-- Right Panel -->
      <div class="flex min-h-0 flex-col bg-[var(--ui-bg)]">
        <div class="flex gap-2 border-b border-[var(--ui-border)] px-2 py-1.5">
          <UInput
            v-model="logFilter"
            :placeholder="t('events.searchLogs')"
            class="min-w-0 flex-1"
          />
        </div>

        <UScrollArea class="min-h-0 flex-1">
          <div
            v-for="row in filteredLogRows"
            :key="row.id"
            class="cursor-pointer border-b border-[var(--ui-border)] px-3 py-2 text-xs leading-relaxed hover:bg-[var(--ui-bg-elevated)]"
            @click="selectedLog = row"
          >
            <div class="flex items-center gap-2">
              <span class="font-mono text-[var(--ui-text-muted)]">{{ row.time }}</span>
              <code class="text-sm text-[var(--ui-primary)]">{{ row.name }}</code>
              <span class="text-[var(--ui-text-muted)]">{{ row.source }}</span>
              <span class="text-[var(--ui-text-muted)]">d{{ row.depth }}</span>
              <span
                v-if="row.payload !== 'undefined'"
                class="min-w-0 flex-1 truncate text-[var(--ui-text-muted)]"
              >
                {{ row.payload }}
              </span>
            </div>
          </div>
          <div
            v-if="filteredLogRows.length === 0"
            class="p-4 text-center text-sm text-[var(--ui-text-muted)]"
          >
            {{ t("common.noEvents") }}
          </div>
        </UScrollArea>
      </div>
    </div>
  </div>

  <UModal
    :open="!!selectedLog"
    @update:open="
      (v) => {
        if (!v) selectedLog = null
      }
    "
  >
    <template #content>
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold">
              {{ t("events.eventDetails") }}
            </h2>
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
            <div class="grid grid-cols-[5rem_1fr] items-baseline gap-2">
              <span class="text-[var(--ui-text-muted)]">{{ t("common.time") }}</span>
              <span class="font-mono">{{ selectedLog.time }}</span>
            </div>
            <div class="grid grid-cols-[5rem_1fr] items-baseline gap-2">
              <span class="text-[var(--ui-text-muted)]">{{ t("common.events") }}</span>
              <code class="font-mono text-[var(--ui-primary)]">{{ selectedLog.name }}</code>
            </div>
            <div class="grid grid-cols-[5rem_1fr] items-baseline gap-2">
              <span class="text-[var(--ui-text-muted)]">{{ t("common.source") }}</span>
              <span>{{ selectedLog.source }}</span>
            </div>
            <div class="grid grid-cols-[5rem_1fr] items-baseline gap-2">
              <span class="text-[var(--ui-text-muted)]">{{ t("common.depth") }}</span>
              <span>{{ selectedLog.depth }}</span>
            </div>
            <div class="grid grid-cols-[5rem_1fr] items-baseline gap-2">
              <span class="text-[var(--ui-text-muted)]">{{ t("common.trace") }}</span>
              <span class="truncate font-mono text-[var(--ui-text-muted)]">{{
                selectedLog.trace
              }}</span>
            </div>
            <div v-if="selectedLog.payload !== 'undefined'" class="space-y-1">
              <span class="text-[var(--ui-text-muted)]">{{ t("common.payload") }}</span>
              <pre class="overflow-auto rounded bg-[var(--ui-bg-elevated)] px-3 py-2 text-xs">{{
                selectedLog.payload
              }}</pre>
            </div>
          </div>
        </UScrollArea>
      </UCard>
    </template>
  </UModal>
</template>
