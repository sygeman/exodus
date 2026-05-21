<script setup lang="ts">
import { computed, ref } from "vue"
import { useRoute } from "vue-router"
import { useProject_flows } from "@/composables/useProject_flows"
import { useEdem } from "@/edem"
import { useT } from "@exodus/edem-vue"

const route = useRoute()
const {
  items: flows,
  loading: flowsLoading,
  create: createProject_flows,
  update: updateProject_flows,
  remove: removeProject_flows,
} = useProject_flows({ filter: { project_id: { _eq: route.params.id } } })
const copied = ref(false)
const loading = computed(() => flowsLoading)
const flow = computed(() => flows.find((entry) => entry.id === route.params.flowId) ?? null)
const manifest = computed(() => (flow ? JSON.stringify(flow.data, null, 2) : ""))
const showSkeleton = ref(false)
const edem = useEdem()
const t = useT()

function handleCopyToClipboard() {
  edem.flows.runFlow({ flow_id: "copyToClipboard" })
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div v-if="loading" class="flex flex-1 items-center justify-center">
      <USkeleton class="h-64 w-96 rounded-lg" />
    </div>
    <div
      v-else-if="!loading && !flow"
      class="text-muted flex flex-1 items-center justify-center text-sm"
    >
      {{ t({ en: "Flow not found", ru: "Поток не найден" }) }}
    </div>
    <div v-else class="relative flex flex-1 overflow-hidden">
      <pre class="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed">{{ manifest }}</pre>
      <UTooltip
        :text="
          copied ? t({ en: 'Copied!', ru: 'Скопировано!' }) : t({ en: 'Copy', ru: 'Копировать' })
        "
      >
        <UButton
          variant="outline"
          size="xs"
          :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
          class="absolute top-3 right-3"
          @click="handleCopyToClipboard()"
        />
      </UTooltip>
    </div>
  </div>
</template>
