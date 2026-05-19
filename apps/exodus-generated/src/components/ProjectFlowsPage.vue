<script setup lang="ts">
import { useRoute, useRouter } from "vue-router"
import { computed, ref, watch } from "vue"
import { useFlows, useCreateItem, useDeleteItem } from "@/hooks"
import { useT } from "@exodus/edem-vue"

const t = useT()

const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.params.id as string)
const [createItem] = useCreateItem()
const [deleteItem] = useDeleteItem()
const { items: flows, loading } = useFlows({
  filter: { project_id: { _eq: projectId.value } },
  sort: ["-created_at"],
})

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
    <div class="mb-4 flex items-center justify-between">
      <h1 class="text-2xl font-bold">{{ t({ en: "Flows", ru: "Потоки" }) }}</h1>
      <UButton @click="handleCreate($event)">{{
        t({ en: "Create flow", ru: "Создать поток" })
      }}</UButton>
    </div>
    <div class="flex flex-col gap-2" v-for="item in flows" :key="item.id">
      <button
        class="border-default hover:bg-elevated flex items-center gap-4 rounded-lg border p-4 text-left transition-colors"
      >
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-500/10">
          <UIcon name="i-lucide-zap" class="h-5 w-5 text-green-500" />
        </div>
        <div class="flex flex-1 flex-col">
          <span class="font-medium">{{ item.data.name }}</span>
        </div>
        <UButton variant="ghost" color="error" size="xs" icon="i-lucide-trash-2" />
      </button>
    </div>
  </div>
</template>
