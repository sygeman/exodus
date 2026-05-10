<script setup lang="ts">
import { useI18n } from "vue-i18n"
import { useRoute, useRouter } from "vue-router"
import { useProjects, PROJECT_COLORS } from "@/composables/useProjects"
import { computed, ref } from "vue"
import SettingsLayout from "@/components/SettingsLayout.vue"
import type { MenuLayoutItem } from "@/components/MenuLayout.vue"

const { t } = useI18n({
  messages: {
    en: {
      Settings: "Settings",
      General: "General",
      "Project Settings": "Project Settings",
      Name: "Name",
      "Project name is displayed in the list and sidebar.":
        "Project name is displayed in the list and sidebar.",
      Color: "Color",
      "Project color is used for visual distinction in the list.":
        "Project color is used for visual distinction in the list.",
      "Delete project": "Delete project",
      "This action cannot be undone. All project data will be permanently deleted.":
        "This action cannot be undone. All project data will be permanently deleted.",
      Delete: "Delete",
      Cancel: "Cancel",
      "Delete project?": "Delete project?",
      "Are you sure you want to delete this project? This action cannot be undone.":
        "Are you sure you want to delete this project? This action cannot be undone.",
      "Project not found": "Project not found",
      "Back to projects": "Back to projects",
    },
    ru: {
      Settings: "Настройки",
      General: "Общие",
      "Project Settings": "Настройки проекта",
      Name: "Название",
      "Project name is displayed in the list and sidebar.":
        "Название проекта отображается в списке и боковом меню.",
      Color: "Цвет",
      "Project color is used for visual distinction in the list.":
        "Цвет проекта используется для визуального выделения в списке.",
      "Delete project": "Удаление проекта",
      "This action cannot be undone. All project data will be permanently deleted.":
        "Это действие нельзя отменить. Все данные проекта будут безвозвратно удалены.",
      Delete: "Удалить",
      Cancel: "Отмена",
      "Delete project?": "Удалить проект?",
      "Are you sure you want to delete this project? This action cannot be undone.":
        "Вы уверены, что хотите удалить этот проект? Это действие необратимо.",
      "Project not found": "Проект не найден",
      "Back to projects": "Назад к проектам",
    },
  },
})

const route = useRoute()
const router = useRouter()
const { projects, loading, update, remove } = useProjects()

const projectId = computed(() => route.params.id as string)
const project = computed(() => projects.value.find((p) => p.id === projectId.value))

const deleteModalOpen = ref(false)

const navItems = computed<MenuLayoutItem[]>(() => [
  {
    to: `/project/${projectId.value}/settings`,
    label: t("General"),
    icon: "i-lucide-settings",
  },
])

function updateName(name: string) {
  if (!project.value || name.trim() === "" || name === project.value.name) return
  update(project.value.id, { name })
}

function updateColor(color: string) {
  if (!project.value || color === project.value.color) return
  update(project.value.id, { color })
}

function openDeleteModal() {
  deleteModalOpen.value = true
}

function confirmDelete() {
  if (!project.value) return
  remove(project.value.id)
  deleteModalOpen.value = false
  router.push("/projects")
}
</script>

<template>
  <div v-if="project" class="flex h-full">
    <SettingsLayout :title="t('Settings')" :items="navItems" :page-title="t('Project Settings')">
      <section class="flex flex-col gap-8">
        <div class="border-default flex flex-col gap-4 border-b pb-8">
          <div class="flex flex-col gap-1">
            <h3 class="text-base font-medium">{{ t("Name") }}</h3>
            <p class="text-muted text-sm">
              {{ t("Project name is displayed in the list and sidebar.") }}
            </p>
          </div>
          <UInput
            class="max-w-md"
            :model-value="project?.name ?? ''"
            @blur="(e: FocusEvent) => updateName((e.target as HTMLInputElement).value)"
            @keyup.enter="(e: KeyboardEvent) => updateName((e.target as HTMLInputElement).value)"
          />
        </div>

        <div class="border-default flex flex-col gap-4 border-b pb-8">
          <div class="flex flex-col gap-1">
            <h3 class="text-base font-medium">{{ t("Color") }}</h3>
            <p class="text-muted text-sm">
              {{ t("Project color is used for visual distinction in the list.") }}
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="c in PROJECT_COLORS"
              :key="c"
              type="button"
              class="focus:ring-primary h-8 w-8 rounded-full transition-transform hover:scale-110 focus:ring-2 focus:outline-none"
              :style="{ backgroundColor: c }"
              :class="{ 'ring-primary ring-2': project?.color === c }"
              @click="updateColor(c)"
            />
          </div>
        </div>

        <div>
          <h3 class="text-error mb-2 text-base font-medium">
            {{ t("Delete project") }}
          </h3>
          <p class="text-muted mb-4 text-sm">
            {{ t("This action cannot be undone. All project data will be permanently deleted.") }}
          </p>
          <UButton color="error" variant="outline" @click="openDeleteModal">
            <UIcon name="i-lucide-trash-2" class="h-4 w-4" />
            <span class="ml-2">{{ t("Delete") }}</span>
          </UButton>
        </div>
      </section>

      <UModal
        v-model:open="deleteModalOpen"
        :title="t('Delete project?')"
        :description="
          t('Are you sure you want to delete this project? This action cannot be undone.')
        "
      >
        <template #footer>
          <div class="flex w-full justify-end gap-3">
            <UButton variant="ghost" @click="deleteModalOpen = false">{{ t("Cancel") }}</UButton>
            <UButton color="error" @click="confirmDelete">{{ t("Delete") }}</UButton>
          </div>
        </template>
      </UModal>
    </SettingsLayout>
  </div>

  <div
    v-else-if="!loading"
    class="text-muted flex h-full flex-col items-center justify-center gap-2"
  >
    <UIcon name="i-lucide-folder-x" class="h-10 w-10" />
    <p>{{ t("Project not found") }}</p>
    <UButton to="/projects" variant="link">{{ t("Back to projects") }}</UButton>
  </div>
</template>
