<script setup lang="ts">
import SettingsLayout from "@/components/SettingsLayout.vue"
import { useT } from "@exodus/edem-vue"

const t = useT()

import { useRoute, useRouter } from "vue-router"
import { computed, ref } from "vue"
import { useCollectionQuery, useUpdateItem, useDeleteItem } from "@/hooks"

const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.params.id as string)
const flowId = computed(() => route.params.flowId as string)

const { data: flows } = useCollectionQuery("flows", () => ({
  filter: { project_id: { _eq: projectId.value } },
}))
const [updateItem] = useUpdateItem()
const [deleteItem] = useDeleteItem()

const flow = computed(() => flows.value.find((f) => f.id === flowId.value))
const deleteModalOpen = ref(false)

const navItems = computed(() => [
  {
    to: `/project/${projectId.value}/flows/${flowId.value}/settings`,
    label: t({ en: "General", ru: "Общие" }),
    icon: "i-lucide-settings",
  },
])

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

function openDeleteModal(_event?: Event) {
  deleteModalOpen.value = true
}

function closeDeleteModal(_event?: Event) {
  deleteModalOpen.value = false
}

function confirmDelete(_event?: Event) {
  if (!flow.value) return
  deleteItem(flow.value.id)
  deleteModalOpen.value = false
  router.push(`/project/${projectId.value}/flows`)
}

const statusItems = [
  { label: "draft", value: "draft" },
  { label: "active", value: "active" },
  { label: "paused", value: "paused" },
  { label: "archived", value: "archived" },
]
</script>

<template>
  <div class="flex h-full">
    <SettingsLayout
      :title="t({ en: 'Settings', ru: 'Настройки' })"
      :items="navItems"
      :page-title="t({ en: 'Flow Settings', ru: 'Настройки флоу' })"
      v-if="flow"
    >
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
          <UInput
            class="max-w-md"
            :model-value="flow.data.name ?? ''"
            @blur="updateName($event)"
            @keyup.enter="updateName($event)"
          />
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
          <USelect
            :model-value="flow.data.status ?? 'draft'"
            :items="statusItems"
            value-key="value"
            label-key="label"
            size="sm"
            class="max-w-md"
            @update:model-value="updateStatus($event)"
          />
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
          <UButton color="error" variant="outline" @click="openDeleteModal($event)">
            <UIcon name="i-lucide-trash-2" class="h-4 w-4" />
            <span class="ml-2">{{ t({ en: "Delete", ru: "Удалить" }) }}</span>
          </UButton>
        </div>
      </section>
      <UModal
        v-model:open="deleteModalOpen"
        :title="t({ en: 'Delete flow?', ru: 'Удалить флоу?' })"
        :description="
          t({
            en: 'Are you sure you want to delete this flow? This action cannot be undone.',
            ru: 'Вы уверены, что хотите удалить этот флоу? Это действие необратимо.',
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
  </div>
</template>
