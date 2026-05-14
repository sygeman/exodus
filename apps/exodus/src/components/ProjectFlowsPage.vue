<script setup lang="ts">
import { useT } from "@exodus/edem-vue"
import { useCollectionQuery, useCreateItem, useDeleteItem } from "@/hooks"
import { useRoute, useRouter } from "vue-router"
import { computed, ref, watch } from "vue"

const t = useT()
const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.params.id as string)
const [createItem] = useCreateItem()
const [deleteItem] = useDeleteItem()

const { data: flows, loading } = useCollectionQuery("flows", () => ({
  filter: { project_id: { _eq: projectId.value } },
  sort: ["-created_at"],
}))

const showSkeleton = ref(false)
let skeletonTimeout: ReturnType<typeof setTimeout> | null = null

watch(
  loading,
  (isLoading) => {
    if (isLoading) {
      skeletonTimeout = setTimeout(() => {
        showSkeleton.value = true
      }, 150)
    } else {
      if (skeletonTimeout) {
        clearTimeout(skeletonTimeout)
        skeletonTimeout = null
      }
      showSkeleton.value = false
    }
  },
  { immediate: true },
)

const STATUS_MAP: Record<string, { label: string; class: string }> = {
  draft: {
    label: "Draft",
    class: "bg-gray-500/10 text-gray-500",
  },
  active: {
    label: "Active",
    class: "bg-green-500/10 text-green-500",
  },
  paused: {
    label: "Paused",
    class: "bg-yellow-500/10 text-yellow-500",
  },
}

const TRIGGER_LABELS: Record<string, string> = {
  event: "Event",
  schedule: "Schedule",
  manual: "Manual",
  webhook: "Webhook",
}

async function handleCreate() {
  const id = await createItem("flows", {
    project_id: projectId.value,
    name: "New Flow",
    status: "draft",
    trigger: { type: "manual" },
    nodes: [
      {
        id: crypto.randomUUID(),
        type: "trigger",
        position: { x: 250, y: 50 },
        data: { triggerType: "manual" },
      },
    ],
    edges: [],
    meta: { viewport: { x: 0, y: 0, zoom: 1 } },
  })
  router.push(`/project/${projectId.value}/flows/${id}`)
}

function getNodeCount(flow: { data: { nodes?: unknown } }): number {
  return Array.isArray(flow.data.nodes) ? flow.data.nodes.length : 0
}

function getTriggerType(flow: { data: { trigger?: unknown } }): string {
  const trigger = flow.data.trigger as Record<string, unknown> | undefined
  return (trigger?.type as string) || ""
}

function goToFlow(flowId: string) {
  router.push(`/project/${projectId.value}/flows/${flowId}/graph`)
}

async function handleDelete(e: Event, flowId: string) {
  e.stopPropagation()
  await deleteItem(flowId)
}
</script>

<template>
  <div class="flex h-full flex-col p-6">
    <div v-if="loading && showSkeleton" class="flex flex-1 flex-col gap-4">
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
      v-else-if="!loading && flows.length === 0"
      class="flex flex-1 flex-col items-center justify-center gap-4"
    >
      <UIcon name="i-lucide-workflow" class="text-muted h-12 w-12" />
      <p class="text-muted text-lg">{{ t({ en: "No flows yet", ru: "Пока нет потоков" }) }}</p>
      <UButton @click="handleCreate">{{ t({ en: "Create flow", ru: "Создать поток" }) }}</UButton>
    </div>

    <div v-else class="flex flex-col gap-2">
      <div class="mb-4 flex items-center justify-between">
        <h1 class="text-2xl font-bold">{{ t({ en: "Flows", ru: "Потоки" }) }}</h1>
        <UButton @click="handleCreate">{{ t({ en: "Create flow", ru: "Создать поток" }) }}</UButton>
      </div>

      <button
        v-for="flow in flows"
        :key="flow.id"
        class="border-default hover:bg-elevated flex items-center gap-4 rounded-lg border p-4 text-left transition-colors"
        @click="goToFlow(flow.id)"
      >
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-500/10 text-sm"
        >
          ⚡
        </div>
        <div class="flex flex-1 flex-col">
          <span class="font-medium">{{ flow.data.name }}</span>
          <div class="text-muted flex items-center gap-2 text-xs">
            <span>{{ TRIGGER_LABELS[getTriggerType(flow)] || "—" }}</span>
            <span>·</span>
            <span>{{ getNodeCount(flow) }} {{ getNodeCount(flow) === 1 ? "node" : "nodes" }}</span>
          </div>
        </div>
        <span
          class="inline-flex h-5 items-center rounded px-1.5 text-xs font-medium"
          :class="STATUS_MAP[flow.data.status || 'draft']?.class"
        >
          {{ STATUS_MAP[flow.data.status || "draft"]?.label }}
        </span>
        <UButton
          variant="ghost"
          color="error"
          size="xs"
          icon="i-lucide-trash-2"
          @click="handleDelete($event, flow.id)"
        />
      </button>
    </div>
  </div>
</template>
