<script setup lang="ts">
import { useT } from "@/composables/useT"
import { useProjects, type Project } from "@/composables/useProjects"
import { useRoute, useRouter } from "vue-router"
import { computed, ref } from "vue"

const t = useT()
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
      label: t({ en: "Project settings", ru: "Настройки проекта" }),
      icon: "i-lucide-settings",
      onSelect: () => router.push(`/project/${project.id}/settings`),
    },
    { type: "separator" as const },
    {
      label: t({ en: "Delete", ru: "Удалить" }),
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

    <UTooltip
      :text="t({ en: 'New project', ru: 'Новый проект' })"
      :content="tooltipContent"
      :delay-duration="0"
    >
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
              <h3 class="text-base font-semibold">
                {{ t({ en: "Delete project?", ru: "Удалить проект?" }) }}
              </h3>
            </div>
          </template>

          <p class="text-muted text-sm">
            {{
              t({
                en: "Are you sure you want to delete this project? This action cannot be undone.",
                ru: "Вы уверены, что хотите удалить этот проект? Это действие необратимо.",
              })
            }}
          </p>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton variant="ghost" @click="deleteModalOpen = false">
                {{ t({ en: "Cancel", ru: "Отмена" }) }}
              </UButton>
              <UButton color="error" @click="confirmDelete">
                {{ t({ en: "Delete", ru: "Удалить" }) }}
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
