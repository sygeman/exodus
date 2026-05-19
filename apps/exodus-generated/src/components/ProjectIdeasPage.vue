<script setup lang="ts">
import { useRoute, useRouter } from "vue-router"
import { computed, ref, watch } from "vue"
import { useIdeas, useCreateItem } from "@/hooks"
import { useT } from "@exodus/edem-vue"

const t = useT()

const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.params.id as string)
const { items: ideas, loading } = useIdeas({
  filter: { project_id: { _eq: projectId.value } },
  sort: ["-created_at"],
})
const [createItem] = useCreateItem()

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
  const id = await createItem("ideas", {
    project_id: projectId.value,
    title: "Untitled",
    status: "draft",
  })
  router.push(`/project/${projectId.value}/ideas/${id}`)
}

function ideaLink(id: string) {
  return `/project/${projectId.value}/ideas/${id}`
}
</script>

<template>
  <div class="flex h-full flex-col p-6">
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-lg font-semibold">{{ t({ en: "Ideas", ru: "Идеи" }) }}</h2>
      <UButton size="sm" @click="handleCreate($event)">
        <UIcon name="i-lucide-plus" class="h-4 w-4" />
        {{ t({ en: "New Idea", ru: "Новая идея" }) }}
      </UButton>
    </div>
    <div class="flex flex-col gap-2" v-for="item in ideas" :key="item.id">
      <RouterLink
        class="border-default hover:bg-elevated flex items-center gap-3 rounded-lg border p-4 transition-colors"
      >
        <div
          class="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded text-xs font-bold"
        >
          {{ item.data.level ?? "?" }}
        </div>
        <div class="flex flex-col">
          <span class="font-medium">{{ item.data.title }}</span>
        </div>
      </RouterLink>
    </div>
  </div>
</template>
