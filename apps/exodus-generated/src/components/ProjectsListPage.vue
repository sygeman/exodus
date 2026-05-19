<script setup lang="ts">
import { useRouter } from "vue-router"
import { ref, watch } from "vue"
import { useProjects, useCreateItem } from "@/hooks"
import { useT } from "@exodus/edem-vue"

const t = useT()

const router = useRouter()
const { items: data, loading } = useProjects()
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
  const name = "Untitled"
  const slug = `${name.toLowerCase().replace(/\s+/g, "-")}-${crypto.randomUUID().slice(0, 8)}`
  const id = await createItem("projects", {
    name,
    slug,
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
    <div class="mb-4 flex items-center justify-between">
      <h1 class="text-2xl font-bold">{{ t({ en: "Projects", ru: "Проекты" }) }}</h1>
      <UButton @click="handleCreate($event)">{{
        t({ en: "Create project", ru: "Создать проект" })
      }}</UButton>
    </div>
    <div class="flex flex-col gap-2" v-for="item in projects" :key="item.id">
      <RouterLink
        class="hover:border-primary border-default flex items-center gap-4 rounded-lg border p-4 transition-colors"
      >
        <div
          class="bg-elevated flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-transparent font-semibold transition-colors"
        >
          {{ getInitials(item.data.name) }}
        </div>
        <span class="font-medium">{{ item.data.name }}</span>
      </RouterLink>
    </div>
  </div>
</template>
