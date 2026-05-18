<script setup lang="ts">
import { useT } from "@/composables/useT"

const t = useT()

import { useRoute, useRouter } from "vue-router"
import { computed, ref } from "vue"
import { useFlows, useUpdateItem, useDeleteItem } from "@/hooks"

const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.params.id as string)
const flowId = computed(() => route.params.flowId as string)

const { items: flows } = useFlows({ filter: { project_id: { _eq: projectId.value } } })
const [updateItem] = useUpdateItem()
const [deleteItem] = useDeleteItem()

const flow = computed(() => flows.value.find((f) => f.id === flowId.value))

const deleteModalOpen = ref(false)

function updateName(e: FocusEvent | KeyboardEvent) {
  const value = (e.target as HTMLInputElement).value
  if (!flow.value) return
  const trimmed = value.trim()
  if (trimmed === "") return
  if (trimmed === flow.value.data.name) return
  updateItem(flow.value.id, { name: trimmed })
}

function updateStatus(value: string) {
  if (!flow.value || value === flow.value.data.status) return
  updateItem(flow.value.id, { status: value })
}

function openDeleteModal() {
  deleteModalOpen.value = true
}

function confirmDelete() {
  if (!flow.value) return
  deleteItem(flow.value.id)
  deleteModalOpen.value = false
  router.push(`/project/${projectId.value}/flows`)
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
                en: "Flow name is displayed in the list and sidebar.",
                ru: "Название флоу отображается в списке и боковом меню.",
              })
            }}
          </p>
        </div>
        <UInput class="max-w-md" :model-value="flow.data.name ?? ''" />
      </div>
      <div class="border-default flex flex-col gap-4 border-b pb-8">
        <div class="flex flex-col gap-1">
          <h3 class="text-base font-medium">{{ t({ en: "Status", ru: "Статус" }) }}</h3>
          <p class="text-muted text-sm">
            {{
              t({
                en: "Flow status determines whether it is running or paused.",
                ru: "Статус флоу определяет, запущен он или приостановлен.",
              })
            }}
          </p>
        </div>
        <USelect :model-value="flow.data.status ?? 'draft'" class="max-w-md" />
      </div>
      <div>
        <h3 class="text-error mb-2 text-base font-medium">
          {{ t({ en: "Delete flow", ru: "Удаление флоу" }) }}
        </h3>
        <p class="text-muted mb-4 text-sm">
          {{
            t({
              en: "This action cannot be undone. All flow data will be permanently deleted.",
              ru: "Это действие нельзя отменить. Все данные флоу будут безвозвратно удалены.",
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
