<script setup lang="ts">
import { useI18n } from "vue-i18n"
import { useRoute, useRouter } from "vue-router"
import { computed, ref, watch } from "vue"
import { useIdeas } from "@/modules/projects/webview"
import { getLevelColor } from "@/modules/projects/composables/useLevelColor"

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.params.id as string)

const { ideas, loading, createAndOpen } = useIdeas(projectId)

const showSkeleton = ref(false)
let skeletonTimeout: ReturnType<typeof setTimeout> | null = null

watch(
  loading,
  (isLoading) => {
    if (isLoading) {
      skeletonTimeout = setTimeout(() => {
        showSkeleton.value = true
      }, 150)
    } else {
      if (skeletonTimeout) {
        clearTimeout(skeletonTimeout)
        skeletonTimeout = null
      }
      showSkeleton.value = false
    }
  },
  { immediate: true },
)

function handleCreate() {
  createAndOpen(router, projectId.value)
}

function ideaLink(id: string) {
  return `/project/${projectId.value}/ideas/${id}`
}
</script>

<template>
  <div class="flex h-full flex-col p-6">
    <!-- Toolbar -->
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-lg font-semibold">{{ t("projects.ideas") }}</h2>
      <UButton size="sm" @click="handleCreate">
        <UIcon name="i-lucide-plus" class="h-4 w-4" />
        {{ t("projects.newIdea") }}
      </UButton>
    </div>

    <!-- Skeleton -->
    <div v-if="loading && showSkeleton" class="flex flex-col gap-3">
      <div
        v-for="i in 3"
        :key="i"
        class="flex items-center gap-3 rounded-lg border border-[var(--ui-border)] p-4"
      >
        <USkeleton class="h-8 w-8 flex-shrink-0 rounded" />
        <USkeleton class="h-5 w-48" />
      </div>
    </div>

    <!-- Empty -->
    <div
      v-else-if="!loading && ideas.length === 0"
      class="flex flex-1 flex-col items-center justify-center gap-2 text-[var(--ui-text-muted)]"
    >
      <UIcon name="i-lucide-lightbulb" class="h-12 w-12 opacity-20" />
      <p class="text-lg">{{ t("projects.emptyIdeas") }}</p>
      <UButton size="sm" @click="handleCreate">{{ t("projects.createFirstIdea") }}</UButton>
    </div>

    <!-- List -->
    <div v-else class="flex flex-col gap-2">
      <RouterLink
        v-for="idea in ideas"
        :key="idea.id"
        :to="ideaLink(idea.id)"
        class="flex items-center gap-3 rounded-lg border border-[var(--ui-border)] p-4 transition-colors hover:bg-[var(--ui-bg-elevated)]"
      >
        <div
          class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded text-xs font-bold"
          :style="{
            backgroundColor: getLevelColor(idea.level) + '20',
            color: getLevelColor(idea.level),
          }"
        >
          {{ idea.level ?? "?" }}
        </div>
        <div class="flex flex-col">
          <span class="font-medium">{{ idea.title }}</span>
          <span v-if="idea.type" class="text-xs text-[var(--ui-text-muted)]">{{ idea.type }}</span>
        </div>
        <span
          v-if="idea.status === 'stabilized'"
          class="ml-auto inline-flex h-5 items-center rounded bg-green-500/10 px-1.5 text-xs text-green-500"
        >
          {{ t("projects.statusStabilized") }}
        </span>
      </RouterLink>
    </div>
  </div>
</template>
