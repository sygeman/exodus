<script setup lang="ts">
import { useI18n } from "vue-i18n"
import { useProjects } from "@/modules/projects/webview"
import { useRouter } from "vue-router"

const { t } = useI18n()
const { projects, loading, createAndOpen } = useProjects()
const router = useRouter()

function handleCreate() {
  createAndOpen(router)
}

function getInitials(name: string): string {
  return name.slice(0, 2).toUpperCase()
}
</script>

<template>
  <div class="flex h-full flex-col p-8">
    <div v-if="loading" class="flex flex-1 items-center justify-center text-[var(--ui-text-muted)]">
      {{ t("common.loading") }}
    </div>

    <div
      v-else-if="projects.length === 0"
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
        :to="`/project/${project.id}`"
        class="flex items-center gap-4 rounded-lg border border-[var(--ui-border)] p-4 transition-colors hover:bg-[var(--ui-bg-elevated)]"
      >
        <div
          class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg font-semibold text-white"
          :style="{ backgroundColor: project.color }"
        >
          {{ getInitials(project.name) }}
        </div>
        <span class="font-medium">{{ project.name }}</span>
      </RouterLink>
    </div>
  </div>
</template>
