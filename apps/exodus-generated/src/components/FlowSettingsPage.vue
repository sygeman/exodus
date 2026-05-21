<script setup lang="ts">
import { computed, ref } from "vue"
import { useRoute } from "vue-router"
import SettingsLayout from "@/components/SettingsLayout.vue"
import { useProject_flows } from "@/composables/useProject_flows"
import { useT } from "@exodus/edem-vue"

const route = useRoute()
const {
  items: flows,
  loading: flowsLoading,
  create: createProject_flows,
  update: updateProject_flows,
  remove: removeProject_flows,
} = useProject_flows({ filter: { project_id: { _eq: route.params.id } } })
const deleteModalOpen = ref(false)
const navItems = [
  {
    to: `/project/${route.params.id}/flows/${route.params.flowId}/settings`,
    label: t({ en: "General", ru: "Общие" }),
    icon: "i-lucide-settings",
  },
]
const statusItems = [
  { label: "draft", value: "draft" },
  { label: "active", value: "active" },
  { label: "paused", value: "paused" },
  { label: "archived", value: "archived" },
]
const flow = computed(() => flows.value.find((entry) => entry.id === route.params.flowId) ?? null)
const t = useT()

async function updateName($event?: Event, item?: Record<string, unknown>) {
  if (!flow.value) return
  if (!((($event as FocusEvent | KeyboardEvent).target as HTMLInputElement).value.trim() !== ""))
    return
  if (
    !(
      (($event as FocusEvent | KeyboardEvent).target as HTMLInputElement).value.trim() !==
      flow.value.name
    )
  )
    return
  await updateProject_flows(flow.value.id, {
    name: (($event as FocusEvent | KeyboardEvent).target as HTMLInputElement).value.trim(),
  })
}

async function updateStatus($event?: Event, item?: Record<string, unknown>) {
  if (!flow.value) return
  if (!($event !== flow.value.status)) return
  await updateProject_flows(flow.value.id, { status: $event })
}

async function openDeleteModal($event?: Event, item?: Record<string, unknown>) {
  deleteModalOpen.value = true
}

async function closeDeleteModal($event?: Event, item?: Record<string, unknown>) {
  deleteModalOpen.value = false
}

async function confirmDelete($event?: Event, item?: Record<string, unknown>) {
  if (!flow.value) return
  await removeProject_flows(flow.value.id)
  deleteModalOpen.value = false
  await router.push(`/project/${route.params.id}/flows`)
}
</script>

<template>
  <div class="flex h-full">
    <SettingsLayout
      v-if="flow"
      :title="t({ en: 'Settings', ru: 'Настройки' })"
      :items="navItems"
      :page-title="t({ en: 'Flow Settings', ru: 'Настройки флоу' })"
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
            :model-value="flow.name ?? ''"
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
            :model-value="flow.status ?? 'draft'"
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
