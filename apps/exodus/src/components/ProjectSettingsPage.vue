<script setup lang="ts">
import { useT } from "@exodus/edem-vue"
import { useCollectionQuery, useUpdateItem, useDeleteItem } from "@/hooks"
import { useRoute, useRouter } from "vue-router"
import { computed, ref } from "vue"
import SettingsLayout from "@/components/SettingsLayout.vue"
import type { MenuLayoutItem } from "@/components/MenuLayout.vue"

const t = useT()
const route = useRoute()
const router = useRouter()
const { data: projects, loading } = useCollectionQuery("projects")
const [updateItem] = useUpdateItem()
const [deleteItem] = useDeleteItem()

const projectId = computed(() => route.params.id as string)
const project = computed(() => projects.value.find((p) => p.id === projectId.value))

const deleteModalOpen = ref(false)

const navItems = computed<MenuLayoutItem[]>(() => [
  {
    to: `/project/${projectId.value}/settings`,
    label: t({ en: "General", ru: "Общие" }),
    icon: "i-lucide-settings",
  },
])

function updateName(name: string) {
  if (!project.value || name.trim() === "" || name === project.value.data.name) return
  updateItem(project.value.id, { name })
}

function openDeleteModal() {
  deleteModalOpen.value = true
}

function confirmDelete() {
  if (!project.value) return
  deleteItem(project.value.id)
  deleteModalOpen.value = false
  router.push("/projects")
}
</script>

<template>
  <div v-if="project" class="flex h-full">
    <SettingsLayout
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
            :model-value="project.data.name ?? ''"
            @blur="(e: FocusEvent) => updateName((e.target as HTMLInputElement).value)"
            @keyup.enter="(e: KeyboardEvent) => updateName((e.target as HTMLInputElement).value)"
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
          <UButton color="error" variant="outline" @click="openDeleteModal">
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
            <UButton variant="ghost" @click="deleteModalOpen = false">
              {{ t({ en: "Cancel", ru: "Отмена" }) }}
            </UButton>
            <UButton color="error" @click="confirmDelete">
              {{ t({ en: "Delete", ru: "Удалить" }) }}
            </UButton>
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
    <p>{{ t({ en: "Project not found", ru: "Проект не найден" }) }}</p>
    <UButton to="/projects" variant="link">
      {{ t({ en: "Back to projects", ru: "Назад к проектам" }) }}
    </UButton>
  </div>
</template>
