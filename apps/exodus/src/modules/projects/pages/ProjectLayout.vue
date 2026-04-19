<script setup lang="ts">
import { useI18n } from "vue-i18n"
import { useRoute } from "vue-router"
import { useProjects } from "@/modules/projects/webview"
import { computed } from "vue"

const { t } = useI18n()
const route = useRoute()
const { projects, loading } = useProjects()

const projectId = computed(() => route.params.id as string)
const project = computed(() => projects.value.find((p) => p.id === projectId.value))

const tabs = computed(() => [
  {
    to: `/project/${projectId.value}/overview`,
    label: t("projects.overview"),
    icon: "i-lucide-layout-grid",
  },
  {
    to: `/project/${projectId.value}/ideas`,
    label: t("projects.ideas"),
    icon: "i-lucide-lightbulb",
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
      <RouterLink
        :to="`/project/${projectId}/overview`"
        class="text-lg font-semibold transition-colors hover:text-[var(--ui-primary)]"
      >
        {{ project.name }}
      </RouterLink>

      <nav class="flex items-center gap-1">
        <RouterLink
          v-for="tab in tabs"
          :key="tab.to"
          :to="tab.to"
          class="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
          :class="{
            'text-[var(--ui-primary)]': route.path.startsWith(tab.to),
            'text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]': !route.path.startsWith(
              tab.to,
            ),
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
    class="flex h-full flex-col items-center justify-center gap-2 text-[var(--ui-text-muted)]"
  >
    <UIcon name="i-lucide-folder-x" class="h-10 w-10" />
    <p>{{ t("projects.notFound") }}</p>
    <UButton to="/projects" variant="link">{{ t("projects.backToList") }}</UButton>
  </div>
</template>
