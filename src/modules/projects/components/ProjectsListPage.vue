<script setup lang="ts">
import { useI18n } from "vue-i18n"
import { useProjects } from "@/modules/projects/webview"
import { useRouter } from "vue-router"
import { ref, watch } from "vue"

const { t } = useI18n()
const { projects, loading, createAndOpen } = useProjects()
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

function handleCreate() {
  createAndOpen(router)
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
        class="flex items-center gap-4 rounded-lg border border-[var(--ui-border)] p-4"
      >
        <USkeleton class="h-10 w-10 flex-shrink-0 rounded-lg" />
        <USkeleton class="h-5 w-48" />
      </div>
    </div>

    <div
      v-else-if="!loading && projects.length === 0"
      class="flex flex-1 flex-col items-center justify-center gap-4"
    >
      <UIcon name="i-lucide-folder-open" class="h-12 w-12 text-[var(--ui-text-muted)]" />
      <p class="text-lg text-[var(--ui-text-muted)]">{{ t("projects.empty") }}</p>
      <UButton @click="handleCreate">{{ t("projects.create") }}</UButton>
    </div>

    <div v-else class="flex flex-col gap-2">
      <div class="mb-4 flex items-center justify-between">
        <h1 class="text-2xl font-bold">{{ t("projects.title") }}</h1>
        <UButton @click="handleCreate">{{ t("projects.create") }}</UButton>
      </div>

      <RouterLink
        v-for="project in projects"
        :key="project.id"
        :to="`/project/${project.id}/board`"
        class="flex items-center gap-4 rounded-lg border border-[var(--ui-border)] p-4 transition-colors hover:bg-[var(--ui-bg-elevated)]"
      >
        <div
          class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border-2 border-solid bg-[var(--ui-bg-elevated)] font-semibold"
          :style="{ color: project.color, borderColor: project.color }"
        >
          {{ getInitials(project.name) }}
        </div>
        <span class="font-medium">{{ project.name }}</span>
      </RouterLink>
    </div>
  </div>
</template>
