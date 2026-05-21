<script setup lang="ts">
import { computed, ref } from "vue"
import { useRoute } from "vue-router"
import { useIdeas } from "@/composables/useIdeas"
import { useEdem } from "@/edem"
import { useT } from "@exodus/edem-vue"

const route = useRoute()
const {
  items: ideas,
  loading: ideasLoading,
  create: createIdeas,
  update: updateIdeas,
  remove: removeIdeas,
} = useIdeas({ filter: { project_id: { _eq: route.params.id } } })
const deleteModalOpen = ref(false)
const levelItems = [
  { label: "L1", value: "L1" },
  { label: "L2", value: "L2" },
  { label: "L3", value: "L3" },
  { label: "L4", value: "L4" },
]
const typeItems = [
  { label: "goal", value: "goal" },
  { label: "non_goal", value: "non_goal" },
  { label: "constraint", value: "constraint" },
  { label: "invariant", value: "invariant" },
  { label: "component", value: "component" },
  { label: "decision", value: "decision" },
  { label: "principle", value: "principle" },
]
const statusItems = [
  { label: "draft", value: "draft" },
  { label: "stabilized", value: "stabilized" },
]
const idea = computed(() => ideas.find((entry) => entry.id === route.params.ideaId) ?? null)
const loading = computed(() => ideasLoading)
const backLink = computed(() => `/project/${route.params.id}/ideas`)
const ideaId = computed(() => route.params.ideaId)
const edem = useEdem()
const t = useT()

function handleOpenDeleteModal() {
  edem.flows.runFlow({ flow_id: "openDeleteModal" })
}

function handleUpdateTitle() {
  edem.flows.runFlow({ flow_id: "updateTitle" })
}

function handleUpdateDescription() {
  edem.flows.runFlow({ flow_id: "updateDescription" })
}

function handleCloseDeleteModal() {
  edem.flows.runFlow({ flow_id: "closeDeleteModal" })
}

function handleConfirmDelete() {
  edem.flows.runFlow({ flow_id: "confirmDelete" })
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div v-if="loading" class="flex h-full items-center justify-center">
      <UIcon name="i-lucide-loader-2" class="text-muted h-8 w-8 animate-spin" />
    </div>
    <div
      v-else-if="!idea"
      class="text-muted flex h-full flex-col items-center justify-center gap-2"
    >
      <UIcon name="i-lucide-file-x" class="h-12 w-12 opacity-20" />
      <p>{{ t({ en: "Idea not found", ru: "Идея не найдена" }) }}</p>
      <UButton :to="backLink" variant="link">{{
        t({ en: "Back to ideas", ru: "Назад к идеям" })
      }}</UButton>
    </div>
    <div v-else class="flex flex-1 flex-col gap-6 overflow-y-auto">
      <div class="border-default flex items-center justify-between border-b px-6 py-3">
        <div class="flex items-center gap-3">
          <UButton :to="backLink" variant="ghost" size="sm" icon="i-lucide-arrow-left">{{
            t({ en: "Back to ideas", ru: "Назад к идеям" })
          }}</UButton>
          <div class="flex flex-wrap items-center gap-2">
            <UBadge
              :label="idea.level || t({ en: 'No level', ru: 'Без уровня' })"
              color="neutral"
              variant="subtle"
              class="bg-primary/10 text-primary text-xs font-semibold"
            />
            <UBadge v-if="idea.type" :label="idea.type" color="neutral" variant="soft" size="sm" />
            <UBadge
              v-if="idea.status === 'stabilized'"
              :label="t({ en: 'Stabilized', ru: 'Стабилизирована' })"
              color="success"
              variant="subtle"
              size="sm"
            />
          </div>
        </div>
        <UButton
          color="error"
          variant="ghost"
          size="sm"
          icon="i-lucide-trash-2"
          @click="handleOpenDeleteModal()"
          >{{ t({ en: "Delete", ru: "Удалить" }) }}</UButton
        >
      </div>
      <div class="flex flex-col gap-6 px-6 pb-6">
        <UInput
          size="lg"
          class="w-full"
          @blur="handleUpdateTitle()"
          @keyup.enter="handleUpdateTitle()"
        />
        <UTextarea
          :placeholder="t({ en: 'Idea description (optional)', ru: 'Описание идеи (опционально)' })"
          :rows="6"
          class="w-full"
          @blur="handleUpdateDescription()"
        />
        <div class="grid grid-cols-3 gap-4">
          <div class="flex flex-col gap-1.5">
            <label class="text-muted text-sm font-medium">{{
              t({ en: "Level", ru: "Уровень" })
            }}</label>
            <USelect
              :items="levelItems"
              value-key="value"
              label-key="label"
              size="sm"
              class="w-full"
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-muted text-sm font-medium">{{ t({ en: "Type", ru: "Тип" }) }}</label>
            <USelect
              :items="typeItems"
              value-key="value"
              label-key="label"
              size="sm"
              class="w-full"
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-muted text-sm font-medium">{{
              t({ en: "Status", ru: "Статус" })
            }}</label>
            <USelect
              :items="statusItems"
              value-key="value"
              label-key="label"
              size="sm"
              class="w-full"
            />
          </div>
        </div>
      </div>
      <UModal
        v-model:open="deleteModalOpen"
        :title="t({ en: 'Delete idea?', ru: 'Удалить идею?' })"
        :description="
          t({
            en: 'Are you sure you want to delete this idea? This action cannot be undone.',
            ru: 'Вы уверены, что хотите удалить эту идею? Это действие необратимо.',
          })
        "
      >
        <template #footer>
          <div class="flex w-full justify-end gap-3">
            <UButton variant="ghost" @click="handleCloseDeleteModal()">{{
              t({ en: "Cancel", ru: "Отмена" })
            }}</UButton>
            <UButton color="error" @click="handleConfirmDelete()">{{
              t({ en: "Delete", ru: "Удалить" })
            }}</UButton>
          </div>
        </template>
      </UModal>
    </div>
  </div>
</template>
