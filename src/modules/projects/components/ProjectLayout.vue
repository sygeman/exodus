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

const tabs = computed(() => [
  {
    to: `/project/${projectId.value}/board`,
    label: t("projects.overview"),
    icon: "i-lucide-layout-grid",
  },
  {
    to: `/project/${projectId.value}/settings`,
    label: t("common.settings"),
    icon: "i-lucide-settings",
  },
])
</script>

<template>
  <div v-if="project" class="flex h-full flex-col">
    <header
      class="flex h-12 flex-shrink-0 items-center justify-between border-b border-[var(--ui-border)] px-6"
    >
      <h1 class="text-lg font-semibold">{{ project.name }}</h1>

      <nav class="flex items-center gap-1">
        <RouterLink
          v-for="tab in tabs"
          :key="tab.to"
          :to="tab.to"
          class="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
          :class="{
            'text-[var(--ui-primary)]': route.path === tab.to,
            'text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]': route.path !== tab.to,
          }"
        >
          <UIcon :name="tab.icon" class="h-4 w-4" />
          {{ tab.label }}
        </RouterLink>
      </nav>
    </header>

    <div class="flex-1 overflow-hidden">
      <RouterView />
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
