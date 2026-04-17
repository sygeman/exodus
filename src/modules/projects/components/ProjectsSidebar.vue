<script setup lang="ts">
import { useI18n } from "vue-i18n"
import { useProjects } from "@/modules/projects/webview"
import { useRoute, useRouter } from "vue-router"
import { computed } from "vue"

const { t } = useI18n()
const { projects, createAndOpen } = useProjects()
const router = useRouter()
const route = useRoute()

const currentProjectId = computed(() => route.params.id as string | undefined)

function handleCreate() {
  createAndOpen(router)
}

const tooltipContent = {
  align: "center" as const,
  side: "right" as const,
  sideOffset: 8,
}

function getInitials(name: string): string {
  return name.slice(0, 2).toUpperCase()
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto">
    <UTooltip
      v-for="project in projects"
      :key="project.id"
      :text="project.name"
      :content="tooltipContent"
      :delay-duration="0"
    >
      <ULink
        :to="`/project/${project.id}/board`"
        class="electrobun-webkit-app-region-no-drag flex h-10 w-10 flex-shrink-0 cursor-pointer items-center justify-center rounded-lg font-semibold transition-all hover:opacity-90"
        :class="
          currentProjectId === project.id
            ? 'bg-[var(--ui-bg)]'
            : 'text-[var(--ui-text-muted)] hover:bg-[var(--ui-bg)] hover:text-[var(--ui-text)]'
        "
        :style="
          currentProjectId === project.id
            ? {
                color: project.color,
                borderColor: project.color,
                borderWidth: '2px',
                borderStyle: 'solid',
              }
            : undefined
        "
      >
        {{ getInitials(project.name) }}
      </ULink>
    </UTooltip>

    <UTooltip :text="t('common.newProject')" :content="tooltipContent" :delay-duration="0">
      <button
        class="electrobun-webkit-app-region-no-drag flex h-10 w-10 flex-shrink-0 cursor-pointer items-center justify-center rounded-lg text-[var(--ui-text-muted)] transition-colors hover:bg-[var(--ui-bg)] hover:text-[var(--ui-text)]"
        @click="handleCreate"
      >
        <UIcon name="i-lucide-plus" class="h-5 w-5" />
      </button>
    </UTooltip>
  </div>
</template>
