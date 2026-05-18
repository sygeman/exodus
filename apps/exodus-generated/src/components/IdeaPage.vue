<script setup lang="ts">
import { useT } from "@/composables/useT"

const t = useT()

import { useRoute, useRouter } from "vue-router"
import { computed, ref, watch, nextTick } from "vue"
import { useIdeas, useUpdateItem, useDeleteItem } from "@/hooks"

const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.params.id as string)
const ideaId = computed(() => route.params.ideaId as string)

const { items: ideas, loading } = useIdeas({ filter: { project_id: { _eq: projectId.value } } })
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
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="border-default flex items-center justify-between border-b px-6 py-3">
      <div class="flex items-center gap-3">
        <UButton :to="backLink" variant="ghost" size="sm" icon="i-lucide-arrow-left">{{
          t({ en: "Back to ideas", ru: "Назад к идеям" })
        }}</UButton>
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
        :model-value="title"
        size="lg"
        class="w-full"
        @blur="updateTitle($event)"
        @keyup.enter="updateTitle($event)"
      />
      <UTextarea
        :model-value="description"
        :placeholder="t({ en: 'Idea description (optional)', ru: 'Описание идеи (опционально)' })"
        :rows="6"
        class="w-full"
        @blur="updateDescription($event)"
      />
    </div>
  </div>
</template>
