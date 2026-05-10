<script setup lang="ts">
import { useI18n } from "vue-i18n"
import { useProjects, type Project } from "@/composables/useProjects"
import { useRoute, useRouter } from "vue-router"
import { computed, ref } from "vue"

const { t } = useI18n({
  messages: {
    en: {
      Delete: "Delete",
      Cancel: "Cancel",
      "New project": "New project",
      "Project settings": "Project settings",
      "Delete project?": "Delete project?",
      "Are you sure you want to delete this project? This action cannot be undone.":
        "Are you sure you want to delete this project? This action cannot be undone.",
    },
    ru: {
      Delete: "Удалить",
      Cancel: "Отмена",
      "New project": "Новый проект",
      "Project settings": "Настройки проекта",
      "Delete project?": "Удалить проект?",
      "Are you sure you want to delete this project? This action cannot be undone.":
        "Вы уверены, что хотите удалить этот проект? Это действие необратимо.",
    },
  },
})

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
      label: t("Project settings"),
      icon: "i-lucide-settings",
      onSelect: () => router.push(`/project/${project.id}/settings`),
    },
    { type: "separator" as const },
    {
      label: t("Delete"),
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
          class="electrobun-webkit-app-region-no-drag bg-default/50 flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg font-semibold transition-all"
          :class="
            currentProjectId === project.id
              ? 'bg-default'
              : 'text-muted hover:bg-default hover:text-default'
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

    <UTooltip :text="t('New project')" :content="tooltipContent" :delay-duration="0">
      <button
        class="electrobun-webkit-app-region-no-drag text-muted hover:bg-default hover:text-default flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors"
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
              <h3 class="text-base font-semibold">{{ t("Delete project?") }}</h3>
            </div>
          </template>

          <p class="text-muted text-sm">
            {{ t("Are you sure you want to delete this project? This action cannot be undone.") }}
          </p>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton variant="ghost" @click="deleteModalOpen = false">
                {{ t("Cancel") }}
              </UButton>
              <UButton color="error" @click="confirmDelete">{{ t("Delete") }}</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
