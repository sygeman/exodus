<script setup lang="ts">
import { useFileObjectUrl, useT } from "@exodus/edem-vue"
import { edem } from "@/edem"
import { useCollectionQuery } from "@/hooks"
import { useRoute } from "vue-router"
import { computed } from "vue"

const t = useT()
const route = useRoute()
const { data: projects, loading } = useCollectionQuery("projects")

const projectId = computed(() => route.params.id as string)
const project = computed(() => projects.value.find((p) => p.id === projectId.value))
const projectLogoHash = computed(() => {
  const logo = project.value?.data.logo
  return typeof logo === "string" && logo.trim() !== "" ? logo : null
})
const { url: projectLogoUrl, loading: projectLogoLoading } = useFileObjectUrl(
  edem.data,
  projectLogoHash,
)

function getInitials(name: string): string {
  return name.slice(0, 2).toUpperCase()
}

const tabs = computed(() => [
  {
    to: `/project/${projectId.value}/overview`,
    label: t({ en: "Overview", ru: "Обзор" }),
    icon: "i-lucide-layout-grid",
  },
  {
    to: `/project/${projectId.value}/ideas`,
    label: t({ en: "Ideas", ru: "Идеи" }),
    icon: "i-lucide-lightbulb",
  },
  {
    to: `/project/${projectId.value}/data`,
    label: t({ en: "Data", ru: "Данные" }),
    icon: "i-lucide-database",
  },
  {
    to: `/project/${projectId.value}/ui`,
    label: t({ en: "UI", ru: "UI" }),
    icon: "i-lucide-panels-top-left",
  },
  {
    to: `/project/${projectId.value}/flows`,
    label: t({ en: "Flows", ru: "Потоки" }),
    icon: "i-lucide-workflow",
  },
  {
    to: `/project/${projectId.value}/settings`,
    label: t({ en: "Settings", ru: "Настройки" }),
    icon: "i-lucide-settings",
  },
])
</script>

<template>
  <div v-if="project" class="flex h-full flex-col">
    <header class="border-default flex h-12 shrink-0 items-center justify-between border-b px-6">
      <RouterLink
        :to="`/project/${projectId}/overview`"
        class="hover:text-primary flex min-w-0 items-center gap-2.5 text-lg font-semibold transition-colors"
      >
        <span
          class="border-default bg-elevated flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg border text-[10px] font-bold"
        >
          <img
            v-if="projectLogoUrl"
            :src="projectLogoUrl"
            :alt="t({ en: 'Project logo', ru: 'Логотип проекта' })"
            class="h-full w-full object-cover"
          />
          <USkeleton v-else-if="projectLogoLoading" class="h-full w-full" />
          <span v-else class="text-muted">{{ getInitials(project.data.name ?? "") }}</span>
        </span>
        <span class="truncate">{{ project.data.name }}</span>
      </RouterLink>

      <nav class="flex items-center gap-1">
        <RouterLink
          v-for="tab in tabs"
          :key="tab.to"
          :to="tab.to"
          class="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
          :class="{
            'text-primary': route.path.startsWith(tab.to),
            'text-muted hover:text-default': !route.path.startsWith(tab.to),
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
    v-else-if="!loading"
    class="text-muted flex h-full flex-col items-center justify-center gap-2"
  >
    <UIcon name="i-lucide-folder-x" class="h-10 w-10" />
    <p>{{ t({ en: "Project not found", ru: "Проект не найден" }) }}</p>
    <UButton to="/projects" variant="link">
      {{ t({ en: "Back to projects", ru: "Назад к проектам" }) }}
    </UButton>
  </div>
</template>
