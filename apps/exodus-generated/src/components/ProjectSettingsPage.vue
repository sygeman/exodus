<script setup lang="ts">
import { useT } from "@/composables/useT"

const t = useT()

import { useRoute, useRouter } from "vue-router"
import { computed, ref } from "vue"
import { useProjects, useUpdateItem, useDeleteItem } from "@/hooks"

const route = useRoute()
const router = useRouter()
const { items: projects, loading } = useProjects()
const [updateItem] = useUpdateItem()
const [deleteItem] = useDeleteItem()

const projectId = computed(() => route.params.id as string)
const project = computed(() => projects.value.find((p) => p.id === projectId.value))

const deleteModalOpen = ref(false)

function updateName(e: FocusEvent | KeyboardEvent) {
  const name = (e.target as HTMLInputElement).value
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
  <div class="flex h-full">
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
        <UInput class="max-w-md" :model-value="project.data.name ?? ''" />
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
        <UButton color="error" variant="outline">
          <UIcon name="i-lucide-trash-2" class="h-4 w-4" />
          <span class="ml-2">{{ t({ en: "Delete", ru: "Удалить" }) }}</span>
        </UButton>
      </div>
    </section>
  </div>
</template>
