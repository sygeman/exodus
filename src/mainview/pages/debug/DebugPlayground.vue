<script setup lang="ts">
import { ref, computed, reactive, onMounted } from "vue"
import { useI18n } from "vue-i18n"
import { useRoute, useRouter } from "vue-router"
import { useEventoDebugger } from "@/mainview/composables/useEventoDebugger"
import { evento } from "@/mainview/evento"

interface RegistryItem {
  name: string
  description?: string
}

interface GroupedEvents {
  namespace: string
  events: RegistryItem[]
}

const { listeners, emitEvent } = useEventoDebugger()

const registry = computed(() => listeners.value.registry)

const eventFilter = ref("")

const filterQuery = computed(() => eventFilter.value.trim().toLowerCase())

const filteredRegistry = computed(() => {
  const q = filterQuery.value
  if (!q) return registry.value
  return registry.value.filter(
    (evt) =>
      evt.name.toLowerCase().includes(q) ||
      (evt.description && t(evt.description).toLowerCase().includes(q)),
  )
})

const groupedEvents = computed(() => {
  const groups = new Map<string, RegistryItem[]>()
  for (const evt of filteredRegistry.value) {
    const idx = evt.name.indexOf(":")
    const namespace = idx > 0 ? evt.name.slice(0, idx) : "default"
    const list = groups.get(namespace)
    if (list) {
      list.push(evt)
    } else {
      groups.set(namespace, [evt])
    }
  }
  const result: GroupedEvents[] = []
  for (const [namespace, events] of groups) {
    events.sort((a, b) => a.name.localeCompare(b.name))
    result.push({ namespace, events })
  }
  result.sort((a, b) => a.namespace.localeCompare(b.namespace))
  return result
})

const totalEvents = computed(() => filteredRegistry.value.length)

function highlightMatch(text: string, query: string) {
  if (!query) return text
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const regex = new RegExp(`(${escaped})`, "gi")
  return text.replace(regex, "<mark class='rounded bg-[var(--ui-primary)]/20 px-0.5'>$1</mark>")
}

const selectedEvent = ref("")
const eventSchema = ref<{
  type: string
  properties?: Record<string, { type: string }>
} | null>(null)
const eventDescription = ref("")
const formValues = reactive<Record<string, unknown>>({})
const playgroundResult = ref<string | null>(null)

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

async function selectEvent(name: string) {
  selectedEvent.value = name
  eventSchema.value = null
  eventDescription.value = ""
  playgroundResult.value = null
  Object.keys(formValues).forEach((key) => delete formValues[key])

  await router.replace({ query: name ? { event: name } : {} })

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
      eventDescription.value = res.data.description ? t(res.data.description) : ""
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

const copiedEventName = ref<string | null>(null)
let copiedTimeout: ReturnType<typeof setTimeout> | null = null

function copyEventName(name: string) {
  navigator.clipboard.writeText(name)
  copiedEventName.value = name
  if (copiedTimeout) clearTimeout(copiedTimeout)
  copiedTimeout = setTimeout(() => {
    copiedEventName.value = null
  }, 1500)
}

onMounted(() => {
  const eventFromQuery = route.query.event
  if (typeof eventFromQuery === "string" && eventFromQuery) {
    selectEvent(eventFromQuery)
  }
})
</script>

<template>
  <div class="flex h-full flex-col bg-[var(--ui-bg)]">
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-[var(--ui-border)] px-4 py-3">
      <div class="flex items-center gap-3">
        <h1 class="text-xl font-bold">{{ t("common.playground") }}</h1>
      </div>
    </div>

    <!-- Main Content -->
    <div class="grid min-h-0 flex-1 grid-cols-[30%_1fr] gap-px bg-[var(--ui-border)]">
      <!-- Left Panel: Registry -->
      <div class="flex min-h-0 flex-col bg-[var(--ui-bg)]">
        <div
          class="flex flex-wrap items-center gap-2 border-b border-[var(--ui-border)] px-2 py-1.5"
        >
          <UInput
            v-model="eventFilter"
            :placeholder="t('events.searchEvents')"
            class="min-w-0 flex-1"
          />
          <span v-if="filterQuery" class="text-xs text-[var(--ui-text-muted)]">
            {{ totalEvents }}
          </span>
        </div>

        <UScrollArea class="min-h-0 flex-1">
          <div
            v-if="groupedEvents.length === 0"
            class="p-4 text-center text-sm text-[var(--ui-text-muted)]"
          >
            {{ t("common.noEvents") }}
          </div>

          <div v-for="group in groupedEvents" :key="group.namespace">
            <div
              class="sticky top-0 z-10 border-b border-[var(--ui-border)] bg-[var(--ui-bg-elevated)]/80 px-3 py-1.5 text-xs font-semibold tracking-wider text-[var(--ui-text-muted)] uppercase backdrop-blur-sm"
            >
              {{ group.namespace }}
            </div>

            <div class="space-y-0.5 px-1 py-1">
              <div
                v-for="evt in group.events"
                :key="evt.name"
                class="cursor-pointer rounded px-2 py-1.5 text-sm transition-colors"
                :class="
                  selectedEvent === evt.name
                    ? 'bg-[var(--ui-primary)]/10 text-[var(--ui-primary)]'
                    : 'hover:bg-[var(--ui-bg-elevated)]'
                "
                @click="selectEvent(evt.name)"
              >
                <div class="flex min-w-0 flex-col">
                  <span
                    class="font-mono text-sm"
                    v-html="highlightMatch(evt.name.slice(group.namespace.length + 1), filterQuery)"
                  />
                  <span
                    v-if="evt.description"
                    class="truncate text-xs text-[var(--ui-text-muted)]"
                    v-html="highlightMatch(t(evt.description), filterQuery)"
                  />
                </div>
              </div>
            </div>
          </div>
        </UScrollArea>
      </div>

      <!-- Right Panel: Playground Form -->
      <div class="flex min-h-0 flex-col bg-[var(--ui-bg)]">
        <UScrollArea class="h-full">
          <div class="space-y-3 p-3">
            <template v-if="selectedEvent">
              <UCard variant="outline">
                <template #header>
                  <div class="flex items-center justify-between">
                    <div>
                      <div class="text-xs text-[var(--ui-text-muted)]">
                        {{ t("common.selected") }}
                      </div>
                      <code class="font-mono text-sm text-[var(--ui-primary)]">{{
                        selectedEvent
                      }}</code>
                    </div>
                    <UTooltip
                      :text="
                        copiedEventName === selectedEvent ? t('common.copied') : t('common.copy')
                      "
                      :open="copiedEventName === selectedEvent"
                      :delay-duration="0"
                    >
                      <UButton
                        :icon="
                          copiedEventName === selectedEvent ? 'i-lucide-check' : 'i-lucide-copy'
                        "
                        :color="copiedEventName === selectedEvent ? 'success' : 'neutral'"
                        variant="ghost"
                        size="sm"
                        @click="copyEventName(selectedEvent)"
                      />
                    </UTooltip>
                  </div>
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
  </div>
</template>
