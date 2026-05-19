<script setup lang="ts">
import { computed, ref } from "vue"
import { useRoute } from "vue-router"
import SettingsLayout from "@/components/SettingsLayout.vue"
import { useProjects } from "@/composables/useProjects"
import { useT } from "@exodus/edem-vue"

const route = useRoute()
const {
  items: projects,
  loading: projectsLoading,
  create: createProjects,
  update: updateProjects,
  remove: removeProjects,
} = useProjects({})
const deleteModalOpen = ref(false)
const navItems = [
  {
    to: `/project/${route.params.id}/settings`,
    label: t({ en: "General", ru: "Общие" }),
    icon: "i-lucide-settings",
  },
]
const project = computed(() => projects.value.find((p) => p.id === route.params.id) ?? null)
const loading = computed(() => projectsLoading.value)
const t = useT()

async function updateName($event?: Event, item?: Record<string, unknown>) {
  if (!project.value) return
  if (!((($event as FocusEvent | KeyboardEvent).target as HTMLInputElement).value.trim() !== ""))
    return
  if (
    !(
      (($event as FocusEvent | KeyboardEvent).target as HTMLInputElement).value !==
      project.value.name
    )
  )
    return
  await updateProjects(project.value.id, {
    name: (($event as FocusEvent | KeyboardEvent).target as HTMLInputElement).value,
  })
}

async function openDeleteModal($event?: Event, item?: Record<string, unknown>) {
  deleteModalOpen.value = true
}

async function closeDeleteModal($event?: Event, item?: Record<string, unknown>) {
  deleteModalOpen.value = false
}

async function confirmDelete($event?: Event, item?: Record<string, unknown>) {
  if (!project.value) return
  await removeProjects(project.value.id)
  deleteModalOpen.value = false
  await router.push("/projects")
}
</script>

<template>
  <div class="flex h-full">
    <SettingsLayout
      v-if="project"
      :title="t({ en: 'Settings', ru: 'Настройки' })"
      :items="navItems"
      :page-title="t({ en: 'Project Settings', ru: 'Настройки проекта' })"
    >
      <section class="flex flex-col gap-8">
        <div class="border-default flex flex-col gap-4 border-b pb-8">
          <div class="flex flex-col gap-1">
            <h3 class="text-base font-medium">{{ t({ en: "Name", ru: "Название" }) }}</h3>
            <p class="text-muted text-sm">
              {{
                t({
                  en: "Project name is displayed in the list and sidebar.",
                  ru: "Название проекта отображается в списке и боковом меню.",
                })
              }}
            </p>
          </div>
          <UInput
            class="max-w-md"
            :model-value="project.name ?? ''"
            @blur="updateName($event)"
            @keyup.enter="updateName($event)"
          />
        </div>
        <div>
          <h3 class="text-error mb-2 text-base font-medium">
            {{ t({ en: "Delete project", ru: "Удаление проекта" }) }}
          </h3>
          <p class="text-muted mb-4 text-sm">
            {{
              t({
                en: "This action cannot be undone. All project data will be permanently deleted.",
                ru: "Это действие нельзя отменить. Все данные проекта будут безвозвратно удалены.",
              })
            }}
          </p>
          <UButton color="error" variant="outline" @click="openDeleteModal($event)">
            <UIcon name="i-lucide-trash-2" class="h-4 w-4" />
            <span class="ml-2">{{ t({ en: "Delete", ru: "Удалить" }) }}</span>
          </UButton>
        </div>
      </section>
      <UModal
        v-model:open="deleteModalOpen"
        :title="t({ en: 'Delete project?', ru: 'Удалить проект?' })"
        :description="
          t({
            en: 'Are you sure you want to delete this project? This action cannot be undone.',
            ru: 'Вы уверены, что хотите удалить этот проект? Это действие необратимо.',
          })
        "
      >
        <template #footer>
          <div class="flex w-full justify-end gap-3">
            <UButton variant="ghost" @click="closeDeleteModal($event)">{{
              t({ en: "Cancel", ru: "Отмена" })
            }}</UButton>
            <UButton color="error" @click="confirmDelete($event)">{{
              t({ en: "Delete", ru: "Удалить" })
            }}</UButton>
          </div>
        </template>
      </UModal>
    </SettingsLayout>
    <div
      v-else-if="!loading"
      class="text-muted flex h-full flex-col items-center justify-center gap-2"
    >
      <UIcon name="i-lucide-folder-x" class="h-10 w-10" />
      <p>{{ t({ en: "Project not found", ru: "Проект не найден" }) }}</p>
      <UButton to="/projects" variant="link">{{
        t({ en: "Back to projects", ru: "Назад к проектам" })
      }}</UButton>
    </div>
  </div>
</template>
