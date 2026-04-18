<script setup lang="ts">
import { useI18n } from "vue-i18n"
import { useRoute, useRouter } from "vue-router"
import { computed, ref, watch, nextTick } from "vue"
import { useIdeas } from "@/modules/projects/webview"
import { getLevelColor } from "@/modules/projects/composables/useLevelColor"

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.params.id as string)
const ideaId = computed(() => route.params.ideaId as string)

const { ideas, loading, update, remove } = useIdeas(projectId)

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
    title.value = i.title
    description.value = i.description ?? ""
    level.value = i.level ?? null
    typeValue.value = i.type ?? null
    status.value = i.status
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
    title.value = idea.value.title
    return
  }
  if (trimmed === idea.value.title) return
  update(idea.value.id, { title: trimmed })
}

function updateDescription() {
  if (!idea.value || description.value === (idea.value.description ?? "")) return
  update(idea.value.id, { description: description.value || null })
}

watch(level, (v) => {
  if (!isInitialized.value || !idea.value || v === idea.value.level) return
  update(idea.value.id, { level: v })
})

watch(typeValue, (v) => {
  if (!isInitialized.value || !idea.value || v === idea.value.type) return
  update(idea.value.id, { type: v })
})

watch(status, (v) => {
  if (!isInitialized.value || !idea.value || v === idea.value.status) return
  update(idea.value.id, { status: v })
})

function openDeleteModal() {
  deleteModalOpen.value = true
}

function confirmDelete() {
  if (!idea.value) return
  remove(idea.value.id)
  deleteModalOpen.value = false
  router.push(`/project/${projectId.value}/ideas`)
}

const LEVELS = ["L0", "L1", "L2", "L3", "L4"]
const TYPES = ["goal", "non_goal", "constraint", "invariant", "component", "decision", "principle"]

const levelItems = [
  { label: t("projects.levelNone"), value: null },
  ...LEVELS.map((l) => ({ label: l, value: l })),
]

const typeItems = [
  { label: t("projects.typeNone"), value: null },
  ...TYPES.map((type) => ({ label: type, value: type })),
]

const statusItems = [
  { label: t("projects.statusDraft"), value: "draft" },
  { label: t("projects.statusStabilized"), value: "stabilized" },
]
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Loading -->
    <div v-if="loading" class="flex h-full items-center justify-center">
      <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-[var(--ui-text-muted)]" />
    </div>

    <!-- Not found -->
    <div
      v-else-if="!idea"
      class="flex h-full flex-col items-center justify-center gap-2 text-[var(--ui-text-muted)]"
    >
      <UIcon name="i-lucide-file-x" class="h-12 w-12 opacity-20" />
      <p>{{ t("projects.ideaNotFound") }}</p>
      <UButton :to="backLink" variant="link">{{ t("projects.backToIdeas") }}</UButton>
    </div>

    <!-- Idea edit -->
    <div v-else class="flex flex-1 flex-col gap-6 overflow-y-auto">
      <!-- Top bar -->
      <div class="flex items-center justify-between border-b border-[var(--ui-border)] px-6 py-3">
        <div class="flex items-center gap-3">
          <UButton :to="backLink" variant="ghost" size="sm" icon="i-lucide-arrow-left">
            {{ t("projects.backToIdeas") }}
          </UButton>
          <div class="flex flex-wrap items-center gap-2">
            <UBadge
              :label="idea.level || t('projects.levelNone')"
              color="neutral"
              variant="subtle"
              :style="{
                backgroundColor: getLevelColor(idea.level) + '20',
                color: getLevelColor(idea.level),
              }"
              class="text-xs font-semibold"
            />
            <UBadge v-if="idea.type" :label="idea.type" color="neutral" variant="soft" size="sm" />
            <UBadge
              v-if="idea.status === 'stabilized'"
              :label="t('projects.statusStabilized')"
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
          {{ t("common.delete") }}
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
          :placeholder="t('projects.ideaDescriptionPlaceholder')"
          :rows="6"
          class="w-full"
          @blur="updateDescription"
        />

        <!-- Fields row -->
        <div class="grid grid-cols-3 gap-4">
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-[var(--ui-text-muted)]">{{
              t("projects.ideaLevel")
            }}</label>
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
            <label class="text-sm font-medium text-[var(--ui-text-muted)]">{{
              t("projects.ideaType")
            }}</label>
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
            <label class="text-sm font-medium text-[var(--ui-text-muted)]">{{
              t("projects.ideaStatus")
            }}</label>
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
        :title="t('projects.deleteIdeaConfirmTitle')"
        :description="t('projects.deleteIdeaConfirmDescription')"
      >
        <template #footer>
          <div class="flex w-full justify-end gap-3">
            <UButton variant="ghost" @click="deleteModalOpen = false">
              {{ t("common.cancel") }}
            </UButton>
            <UButton color="error" @click="confirmDelete">
              {{ t("common.delete") }}
            </UButton>
          </div>
        </template>
      </UModal>
    </div>
  </div>
</template>
