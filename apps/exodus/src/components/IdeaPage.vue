<script setup lang="ts">
import { useT } from "@exodus/edem-vue"
import { useCollectionQuery, useUpdateItem, useDeleteItem } from "@/hooks"
import { useRoute, useRouter } from "vue-router"
import { computed, ref, watch, nextTick } from "vue"
import { getLevelColor } from "@/composables/useLevelColor"

const t = useT()
const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.params.id as string)
const ideaId = computed(() => route.params.ideaId as string)

const { data: ideas, loading } = useCollectionQuery("ideas", () => ({
  filter: { project_id: { _eq: projectId.value } },
}))
const [updateItem] = useUpdateItem()
const [deleteItem] = useDeleteItem()

const idea = computed(() => ideas.value.find((i) => i.id === ideaId.value) ?? null)

const backLink = computed(() => `/project/${projectId.value}/ideas`)

const deleteModalOpen = ref(false)

const title = ref("")
const description = ref("")
const level = ref<string | null>(null)
const typeValue = ref<string | null>(null)
const status = ref<string>("draft")
const isInitialized = ref(false)

watch(
  idea,
  (i) => {
    if (!i) return
    title.value = i.data.title ?? ""
    description.value = i.data.description ?? ""
    level.value = i.data.level ?? null
    typeValue.value = i.data.type ?? null
    status.value = i.data.status ?? "draft"
    nextTick(() => {
      isInitialized.value = true
    })
  },
  { immediate: true },
)

function updateTitle() {
  if (!idea.value) return
  const trimmed = title.value.trim()
  if (trimmed === "") {
    title.value = idea.value.data.title ?? ""
    return
  }
  if (trimmed === idea.value.data.title) return
  updateItem(idea.value.id, { title: trimmed })
}

function updateDescription() {
  if (!idea.value || description.value === (idea.value.data.description ?? "")) return
  updateItem(idea.value.id, { description: description.value || null })
}

watch(level, (v) => {
  if (!isInitialized.value || !idea.value || v === idea.value.data.level) return
  updateItem(idea.value.id, { level: v })
})

watch(typeValue, (v) => {
  if (!isInitialized.value || !idea.value || v === idea.value.data.type) return
  updateItem(idea.value.id, { type: v })
})

watch(status, (v) => {
  if (!isInitialized.value || !idea.value || v === idea.value.data.status) return
  updateItem(idea.value.id, { status: v })
})

function openDeleteModal() {
  deleteModalOpen.value = true
}

function confirmDelete() {
  if (!idea.value) return
  deleteItem(idea.value.id)
  deleteModalOpen.value = false
  router.push(`/project/${projectId.value}/ideas`)
}

const LEVELS = ["L0", "L1", "L2", "L3", "L4"]
const TYPES = ["goal", "non_goal", "constraint", "invariant", "component", "decision", "principle"]

const levelItems = [
  { label: t({ en: "No level", ru: "Без уровня" }), value: null },
  ...LEVELS.map((l) => ({ label: l, value: l })),
]

const typeItems = [
  { label: t({ en: "No type", ru: "Без типа" }), value: null },
  ...TYPES.map((type) => ({ label: type, value: type })),
]

const statusItems = [
  { label: t({ en: "Draft", ru: "Черновик" }), value: "draft" },
  { label: t({ en: "Stabilized", ru: "Стабилизирована" }), value: "stabilized" },
]
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Loading -->
    <div v-if="loading" class="flex h-full items-center justify-center">
      <UIcon name="i-lucide-loader-2" class="text-muted h-8 w-8 animate-spin" />
    </div>

    <!-- Not found -->
    <div
      v-else-if="!idea"
      class="text-muted flex h-full flex-col items-center justify-center gap-2"
    >
      <UIcon name="i-lucide-file-x" class="h-12 w-12 opacity-20" />
      <p>{{ t({ en: "Idea not found", ru: "Идея не найдена" }) }}</p>
      <UButton :to="backLink" variant="link">
        {{ t({ en: "Back to ideas", ru: "Назад к идеям" }) }}
      </UButton>
    </div>

    <!-- Idea edit -->
    <div v-else class="flex flex-1 flex-col gap-6 overflow-y-auto">
      <!-- Top bar -->
      <div class="border-default flex items-center justify-between border-b px-6 py-3">
        <div class="flex items-center gap-3">
          <UButton :to="backLink" variant="ghost" size="sm" icon="i-lucide-arrow-left">
            {{ t({ en: "Back to ideas", ru: "Назад к идеям" }) }}
          </UButton>
          <div class="flex flex-wrap items-center gap-2">
            <UBadge
              :label="idea.data.level || t({ en: 'No level', ru: 'Без уровня' })"
              color="neutral"
              variant="subtle"
              :style="{
                backgroundColor: getLevelColor(idea.data.level) + '20',
                color: getLevelColor(idea.data.level),
              }"
              class="text-xs font-semibold"
            />
            <UBadge
              v-if="idea.data.type"
              :label="idea.data.type"
              color="neutral"
              variant="soft"
              size="sm"
            />
            <UBadge
              v-if="idea.data.status === 'stabilized'"
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
          @click="openDeleteModal"
        >
          {{ t({ en: "Delete", ru: "Удалить" }) }}
        </UButton>
      </div>

      <!-- Content -->
      <div class="flex flex-col gap-6 px-6 pb-6">
        <!-- Title -->
        <UInput
          v-model="title"
          size="lg"
          class="w-full"
          @blur="updateTitle"
          @keyup.enter="updateTitle"
        />

        <!-- Description -->
        <UTextarea
          v-model="description"
          :placeholder="t({ en: 'Idea description (optional)', ru: 'Описание идеи (опционально)' })"
          :rows="6"
          class="w-full"
          @blur="updateDescription"
        />

        <!-- Fields row -->
        <div class="grid grid-cols-3 gap-4">
          <div class="flex flex-col gap-1.5">
            <label class="text-muted text-sm font-medium">
              {{ t({ en: "Level", ru: "Уровень" }) }}
            </label>
            <USelect
              v-model="level"
              :items="levelItems"
              value-key="value"
              label-key="label"
              size="sm"
              class="w-full"
            />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-muted text-sm font-medium">
              {{ t({ en: "Type", ru: "Тип" }) }}
            </label>
            <USelect
              v-model="typeValue"
              :items="typeItems"
              value-key="value"
              label-key="label"
              size="sm"
              class="w-full"
            />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-muted text-sm font-medium">
              {{ t({ en: "Status", ru: "Статус" }) }}
            </label>
            <USelect
              v-model="status"
              :items="statusItems"
              value-key="value"
              label-key="label"
              size="sm"
              class="w-full"
            />
          </div>
        </div>
      </div>

      <!-- Delete confirmation modal -->
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
            <UButton variant="ghost" @click="deleteModalOpen = false">
              {{ t({ en: "Cancel", ru: "Отмена" }) }}
            </UButton>
            <UButton color="error" @click="confirmDelete">
              {{ t({ en: "Delete", ru: "Удалить" }) }}
            </UButton>
          </div>
        </template>
      </UModal>
    </div>
  </div>
</template>
