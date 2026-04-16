<script setup lang="ts">
import { useI18n } from "vue-i18n"
import { useRoute } from "vue-router"
import { useProjects } from "@/modules/projects/webview"
import { computed } from "vue"

const { t } = useI18n()
const route = useRoute()
const { projects } = useProjects()

const projectId = computed(() => route.params.id as string)
const project = computed(() => projects.value.find((p) => p.id === projectId.value))
</script>

<template>
  <div v-if="project" class="flex h-full flex-col">
    <header
      class="flex h-12 flex-shrink-0 items-center justify-between border-b border-[var(--ui-border)] px-6"
    >
      <h1 class="text-lg font-semibold">{{ project.name }}</h1>
      <UButton color="neutral" variant="ghost" :to="`/project/${project.id}/settings`">
        <UIcon name="i-lucide-settings" class="h-4 w-4" />
        <span class="ml-2">{{ t("common.settings") }}</span>
      </UButton>
    </header>

    <div class="flex-1 p-6">
      <!-- Контент проекта будет здесь -->
    </div>
  </div>

  <div
    v-else
    class="flex h-full flex-col items-center justify-center gap-2 text-[var(--ui-text-muted)]"
  >
    <UIcon name="i-lucide-folder-x" class="h-10 w-10" />
    <p>{{ t("projects.notFound") }}</p>
    <UButton to="/projects" variant="link">{{ t("projects.backToList") }}</UButton>
  </div>
</template>
