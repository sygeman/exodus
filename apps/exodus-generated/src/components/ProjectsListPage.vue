<script setup lang="ts">
import { ref } from "vue"
import { useProjects } from "@/composables/useProjects"
import { useT } from "@exodus/edem-vue"

const {
  items: data,
  loading: dataLoading,
  create: createProjects,
  update: updateProjects,
  remove: removeProjects,
} = useProjects({})
const showSkeleton = ref(false)
const t = useT()

async function handleCreate($event?: Event, item?: Record<string, unknown>) {
  const createdIdResult = await createProjects({
    name: "Untitled",
    slug: `untitled-${crypto.randomUUID().slice(0, 8)}`,
    type: "desktop",
    sort_order: 0,
  })
  const createdId = typeof createdIdResult === "string" ? createdIdResult : createdIdResult.id
  await router.push(`/project/${createdId}/overview`)
}

function getInitials(name: string): string {
  return name.slice(0, 2).toUpperCase()
}
</script>

<template>
  <div class="flex h-full flex-col p-8">
    <div v-if="dataLoading" class="flex flex-1 flex-col gap-4">
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
      v-else-if="!dataLoading && data.length === 0"
      class="flex flex-1 flex-col items-center justify-center gap-4"
    >
      <UIcon name="i-lucide-folder-open" class="text-muted h-12 w-12" />
      <p class="text-muted text-lg">{{ t({ en: "No projects yet", ru: "Пока нет проектов" }) }}</p>
      <UButton @click="handleCreate($event)">{{
        t({ en: "Create project", ru: "Создать проект" })
      }}</UButton>
    </div>
    <div v-else class="flex flex-col gap-2">
      <div class="mb-4 flex items-center justify-between">
        <h1 class="text-2xl font-bold">{{ t({ en: "Projects", ru: "Проекты" }) }}</h1>
        <UButton @click="handleCreate($event)">{{
          t({ en: "Create project", ru: "Создать проект" })
        }}</UButton>
      </div>
      <RouterLink
        v-for="project in data"
        :key="project.id"
        :to="`/project/${project.id}/overview`"
        class="hover:border-primary border-default flex items-center gap-4 rounded-lg border p-4 transition-colors"
      >
        <div
          class="bg-elevated flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-transparent font-semibold transition-colors"
        >
          {{ getInitials(project.name) }}
        </div>
        <span class="font-medium">{{ project.name }}</span>
      </RouterLink>
    </div>
  </div>
</template>
