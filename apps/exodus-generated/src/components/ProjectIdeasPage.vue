<script setup lang="ts">
import { useRoute, useRouter } from "vue-router"
import { computed, ref, watch } from "vue"
import { useCollectionQuery, useCreateItem } from "@/hooks"
import { useT } from "@exodus/edem-vue"

const t = useT()

const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.params.id as string)

const { data: ideas, loading } = useCollectionQuery("ideas", () => ({
  filter: { project_id: { _eq: projectId.value } },
  sort: ["-created_at"],
}))
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
      <UButton size="sm" @click="handleCreate">
        <UIcon name="i-lucide-plus" class="h-4 w-4" />
        {{ t({ en: "New Idea", ru: "Новая идея" }) }}
      </UButton>
    </div>
    <div v-if="loading && showSkeleton" class="flex flex-col gap-3">
      <div
        v-for="i in 3"
        :key="i"
        class="border-default flex items-center gap-3 rounded-lg border p-4"
      >
        <USkeleton class="h-8 w-8 shrink-0 rounded" />
        <USkeleton class="h-5 w-48" />
      </div>
    </div>
    <div
      v-else-if="!loading && ideas.length === 0"
      class="text-muted flex flex-1 flex-col items-center justify-center gap-2"
    >
      <UIcon name="i-lucide-lightbulb" class="h-12 w-12 opacity-20" />
      <p class="text-lg">{{ t({ en: "No ideas yet", ru: "Пока нет идей" }) }}</p>
      <UButton size="sm" @click="handleCreate">{{
        t({ en: "Create first idea", ru: "Создать первую идею" })
      }}</UButton>
    </div>
    <div v-else class="flex flex-col gap-2">
      <RouterLink
        v-for="idea in ideas"
        :key="idea.id"
        :to="ideaLink(idea.id)"
        class="border-default hover:bg-elevated flex items-center gap-3 rounded-lg border p-4 transition-colors"
      >
        <div
          class="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded text-xs font-bold"
        >
          {{ idea.data.level ?? "?" }}
        </div>
        <div class="flex flex-col">
          <span class="font-medium">{{ idea.data.title }}</span>
          <span v-if="idea.data.type" class="text-muted text-xs">{{ idea.data.type }}</span>
        </div>
        <span
          v-if="idea.data.status === 'stabilized'"
          class="ml-auto inline-flex h-5 items-center rounded bg-green-500/10 px-1.5 text-xs text-green-500"
          >{{ t({ en: "Stabilized", ru: "Стабилизирована" }) }}</span
        >
      </RouterLink>
    </div>
  </div>
</template>
