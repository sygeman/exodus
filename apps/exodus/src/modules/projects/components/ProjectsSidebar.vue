<script setup lang="ts">
import { useI18n } from "vue-i18n"
import { useProjects, type Project } from "@/modules/projects/webview"
import { useRoute, useRouter } from "vue-router"
import { computed, ref } from "vue"

const { t } = useI18n()
const { projects, createAndOpen, remove } = useProjects()
const router = useRouter()
const route = useRoute()

const currentProjectId = computed(() => route.params.id as string | undefined)
const deleteModalOpen = ref(false)
const projectToDelete = ref<Project | null>(null)

function handleCreate() {
  createAndOpen(router)
}

function openDeleteModal(project: Project) {
  projectToDelete.value = project
  deleteModalOpen.value = true
}

function confirmDelete() {
  if (projectToDelete.value) {
    remove(projectToDelete.value.id)
    deleteModalOpen.value = false
    projectToDelete.value = null
  }
}

function getContextMenuItems(project: Project) {
  return [
    {
      label: t("projects.projectSettings"),
      icon: "i-lucide-settings",
      onSelect: () => router.push(`/project/${project.id}/settings`),
    },
    { type: "separator" as const },
    {
      label: t("common.delete"),
      icon: "i-lucide-trash-2",
      color: "error" as const,
      onSelect: () => openDeleteModal(project),
    },
  ]
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
  <div
    class="scrollbar-hidden flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto pt-2 select-none"
  >
    <UContextMenu
      v-for="project in projects"
      :key="project.id"
      :items="getContextMenuItems(project)"
    >
      <UTooltip :text="project.name" :content="tooltipContent" :delay-duration="0">
        <ULink
          :to="`/project/${project.id}/overview`"
          class="electrobun-webkit-app-region-no-drag bg-default/50 flex h-10 w-10 flex-shrink-0 cursor-pointer items-center justify-center rounded-lg font-semibold transition-all"
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
    </UContextMenu>

    <UTooltip :text="t('common.newProject')" :content="tooltipContent" :delay-duration="0">
      <button
        class="electrobun-webkit-app-region-no-drag flex h-10 w-10 flex-shrink-0 cursor-pointer items-center justify-center rounded-lg text-[var(--ui-text-muted)] transition-colors hover:bg-[var(--ui-bg)] hover:text-[var(--ui-text)]"
        @click="handleCreate"
      >
        <UIcon name="i-lucide-plus" class="h-5 w-5" />
      </button>
    </UTooltip>

    <UModal v-model:open="deleteModalOpen">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-alert-triangle" class="text-error h-5 w-5" />
              <h3 class="text-base font-semibold">{{ t("projects.deleteConfirmTitle") }}</h3>
            </div>
          </template>

          <p class="text-sm text-[var(--ui-text-muted)]">
            {{ t("projects.deleteConfirmDescription") }}
          </p>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton variant="ghost" @click="deleteModalOpen = false">
                {{ t("common.cancel") }}
              </UButton>
              <UButton color="error" @click="confirmDelete">{{ t("common.delete") }}</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
