<script setup lang="ts">
import { ref } from "vue"
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
} = useProject_flows({ filter: { project_id: { _eq: route.params.id } }, sort: ["-created_at"] })
const STATUS_MAP = {
  draft: { label: "Draft", class: "bg-gray-500/10 text-gray-500" },
  active: { label: "Active", class: "bg-green-500/10 text-green-500" },
  paused: { label: "Paused", class: "bg-yellow-500/10 text-yellow-500" },
}
const TRIGGER_LABELS = { event: "Event", schedule: "Schedule", manual: "Manual" }
const showSkeleton = ref(false)
const edem = useEdem()
const t = useT()

function handleCreate() {
  edem.flows.runFlow({ flow_id: "create" })
}

function handleGoToFlow() {
  edem.flows.runFlow({ flow_id: "goToFlow" })
}

function handleDelete() {
  edem.flows.runFlow({ flow_id: "delete" })
}
</script>

<template>
  <div class="flex h-full flex-col p-6">
    <div v-if="flowsLoading" class="flex flex-1 flex-col gap-4">
      <div class="mb-4 flex items-center justify-between">
        <USkeleton class="h-8 w-40" />
        <USkeleton class="h-9 w-32" />
      </div>
      <div
        v-for="i in 3"
        :key="i"
        class="border-default flex items-center gap-4 rounded-lg border p-4"
      >
        <USkeleton class="h-10 w-10 shrink-0 rounded-lg" />
        <USkeleton class="h-5 w-48" />
      </div>
    </div>
    <div
      v-else-if="!flowsLoading && flows.length === 0"
      class="flex flex-1 flex-col items-center justify-center gap-4"
    >
      <UIcon name="i-lucide-workflow" class="text-muted h-12 w-12" />
      <p class="text-muted text-lg">{{ t({ en: "No flows yet", ru: "Пока нет потоков" }) }}</p>
      <UButton @click="handleCreate()">{{ t({ en: "Create flow", ru: "Создать поток" }) }}</UButton>
    </div>
    <div v-else class="flex flex-col gap-2">
      <div class="mb-4 flex items-center justify-between">
        <h1 class="text-2xl font-bold">{{ t({ en: "Flows", ru: "Потоки" }) }}</h1>
        <UButton @click="handleCreate()">{{
          t({ en: "Create flow", ru: "Создать поток" })
        }}</UButton>
      </div>
      <button
        v-for="flow in flows"
        :key="flow.id"
        class="border-default hover:bg-elevated flex items-center gap-4 rounded-lg border p-4 text-left transition-colors"
        @click="handleGoToFlow()"
      >
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-500/10">
          <UIcon name="i-lucide-zap" class="h-5 w-5 text-green-500" />
        </div>
        <div class="flex flex-1 flex-col">
          <span class="font-medium">{{ flow.name }}</span>
          <div class="text-muted flex items-center gap-2 text-xs">
            <span>{{ TRIGGER_LABELS[flow.trigger?.type || ""] || "—" }}</span>
            <span>·</span>
            <span
              >{{ Array.isArray(flow.nodes) ? flow.nodes.length : 0 }}
              {{
                (Array.isArray(flow.nodes) ? flow.nodes.length : 0) === 1 ? "node" : "nodes"
              }}</span
            >
          </div>
        </div>
        <span
          class="inline-flex h-5 items-center rounded px-1.5 text-xs font-medium"
          :class="STATUS_MAP[flow.status || 'draft']?.class"
          >{{ STATUS_MAP[flow.status || "draft"]?.label }}</span
        >
        <UButton
          variant="ghost"
          color="error"
          size="xs"
          icon="i-lucide-trash-2"
          @click="handleDelete()"
        />
      </button>
    </div>
  </div>
</template>
