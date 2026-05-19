<script setup lang="ts">
import { computed, ref } from "vue"
import { useRoute } from "vue-router"
import { useIdeas } from "@/composables/useIdeas"
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
const idea = computed(() => ideas.value.find((entry) => entry.id === route.params.ideaId) ?? null)
const loading = computed(() => ideasLoading.value)
const backLink = computed(() => `/project/${route.params.id}/ideas`)
const ideaId = computed(() => route.params.ideaId)
const t = useT()

async function openDeleteModal($event?: Event, item?: Record<string, unknown>) {
  deleteModalOpen.value = true
}

async function closeDeleteModal($event?: Event, item?: Record<string, unknown>) {
  deleteModalOpen.value = false
}

async function confirmDelete($event?: Event, item?: Record<string, unknown>) {
  if (!idea.value) return
  await removeIdeas(idea.value.id)
  deleteModalOpen.value = false
  await router.push(backLink.value)
}

async function updateTitle($event?: Event, item?: Record<string, unknown>) {
  if (!idea.value) return
  if (!((($event as FocusEvent | KeyboardEvent).target as HTMLInputElement).value.trim() !== ""))
    return
  if (
    !(
      (($event as FocusEvent | KeyboardEvent).target as HTMLInputElement).value.trim() !==
      (idea.value.title ?? "")
    )
  )
    return
  await updateIdeas(idea.value.id, {
    title: (($event as FocusEvent | KeyboardEvent).target as HTMLInputElement).value.trim(),
  })
}

async function updateDescription($event?: Event, item?: Record<string, unknown>) {
  if (!idea.value) return
  if (
    !(
      (($event as FocusEvent).target as HTMLTextAreaElement).value !==
      (idea.value.description ?? "")
    )
  )
    return
  await updateIdeas(idea.value.id, {
    description: (($event as FocusEvent).target as HTMLTextAreaElement).value || null,
  })
}

async function updateLevel($event?: Event, item?: Record<string, unknown>) {
  if (!idea.value) return
  if (!($event !== idea.value.level)) return
  await updateIdeas(idea.value.id, { level: $event })
}

async function updateType($event?: Event, item?: Record<string, unknown>) {
  if (!idea.value) return
  if (!($event !== idea.value.type)) return
  await updateIdeas(idea.value.id, { type: $event })
}

async function updateStatus($event?: Event, item?: Record<string, unknown>) {
  if (!idea.value) return
  if (!($event !== idea.value.status)) return
  await updateIdeas(idea.value.id, { status: $event })
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
          @click="openDeleteModal($event)"
          >{{ t({ en: "Delete", ru: "Удалить" }) }}</UButton
        >
      </div>
      <div class="flex flex-col gap-6 px-6 pb-6">
        <UInput
          :model-value="idea.title ?? ''"
          size="lg"
          class="w-full"
          @blur="updateTitle($event)"
          @keyup.enter="updateTitle($event)"
        />
        <UTextarea
          :model-value="idea.description ?? ''"
          :placeholder="t({ en: 'Idea description (optional)', ru: 'Описание идеи (опционально)' })"
          :rows="6"
          class="w-full"
          @blur="updateDescription($event)"
        />
        <div class="grid grid-cols-3 gap-4">
          <div class="flex flex-col gap-1.5">
            <label class="text-muted text-sm font-medium">{{
              t({ en: "Level", ru: "Уровень" })
            }}</label>
            <USelect
              :model-value="idea.level ?? null"
              :items="levelItems"
              value-key="value"
              label-key="label"
              size="sm"
              class="w-full"
              @update:model-value="updateLevel($event)"
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-muted text-sm font-medium">{{ t({ en: "Type", ru: "Тип" }) }}</label>
            <USelect
              :model-value="idea.type ?? null"
              :items="typeItems"
              value-key="value"
              label-key="label"
              size="sm"
              class="w-full"
              @update:model-value="updateType($event)"
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-muted text-sm font-medium">{{
              t({ en: "Status", ru: "Статус" })
            }}</label>
            <USelect
              :model-value="idea.status ?? 'draft'"
              :items="statusItems"
              value-key="value"
              label-key="label"
              size="sm"
              class="w-full"
              @update:model-value="updateStatus($event)"
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
            <UButton variant="ghost" @click="closeDeleteModal($event)">{{
              t({ en: "Cancel", ru: "Отмена" })
            }}</UButton>
            <UButton color="error" @click="confirmDelete($event)">{{
              t({ en: "Delete", ru: "Удалить" })
            }}</UButton>
          </div>
        </template>
      </UModal>
    </div>
  </div>
</template>
