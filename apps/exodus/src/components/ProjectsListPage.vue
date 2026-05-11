<script setup lang="ts">
import { useT } from "@exodus/edem-vue"
import { useCollectionQuery, useCreateItem } from "@/hooks"
import { useRouter } from "vue-router"
import { ref, watch } from "vue"

const t = useT()
const { data, loading } = useCollectionQuery("projects")
const [createItem] = useCreateItem()
const router = useRouter()

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

const PROJECT_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#a855f7",
  "#ec4899",
]

function getRandomColor(): string {
  return PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)]
}

async function handleCreate() {
  const name = "Untitled"
  const slug = `${name.toLowerCase().replace(/\s+/g, "-")}-${crypto.randomUUID().slice(0, 8)}`
  const id = await createItem("projects", {
    name,
    slug,
    color: getRandomColor(),
    type: "desktop",
    sort_order: 0,
  })
  router.push(`/project/${id}/overview`)
}

function getInitials(name: string): string {
  return name.slice(0, 2).toUpperCase()
}
</script>

<template>
  <div class="flex h-full flex-col p-8">
    <div v-if="loading && showSkeleton" class="flex flex-1 flex-col gap-4">
      <div class="mb-4 flex items-center justify-between">
        <USkeleton class="h-8 w-40" />
        <USkeleton class="h-9 w-32" />
      </div>
      <div
        v-for="i in 5"
        :key="i"
        class="border-default flex items-center gap-4 rounded-lg border p-4"
      >
        <USkeleton class="h-10 w-10 shrink-0 rounded-lg" />
        <USkeleton class="h-5 w-48" />
      </div>
    </div>

    <div
      v-else-if="!loading && data.length === 0"
      class="flex flex-1 flex-col items-center justify-center gap-4"
    >
      <UIcon name="i-lucide-folder-open" class="text-muted h-12 w-12" />
      <p class="text-muted text-lg">{{ t({ en: "No projects yet", ru: "Пока нет проектов" }) }}</p>
      <UButton @click="handleCreate">{{
        t({ en: "Create project", ru: "Создать проект" })
      }}</UButton>
    </div>

    <div v-else class="flex flex-col gap-2">
      <div class="mb-4 flex items-center justify-between">
        <h1 class="text-2xl font-bold">{{ t({ en: "Projects", ru: "Проекты" }) }}</h1>
        <UButton @click="handleCreate">{{
          t({ en: "Create project", ru: "Создать проект" })
        }}</UButton>
      </div>

      <RouterLink
        v-for="project in data"
        :key="project.id"
        :to="`/project/${project.id}/overview`"
        class="border-default hover:bg-elevated flex items-center gap-4 rounded-lg border p-4 transition-colors"
      >
        <div
          class="bg-elevated flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-solid font-semibold"
          :style="{
            color: project.data.color ?? undefined,
            borderColor: project.data.color ?? undefined,
          }"
        >
          {{ getInitials(project.data.name) }}
        </div>
        <span class="font-medium">{{ project.data.name }}</span>
      </RouterLink>
    </div>
  </div>
</template>
