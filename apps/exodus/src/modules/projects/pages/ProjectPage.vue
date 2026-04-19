<script setup lang="ts">
import { useI18n } from "vue-i18n"
import { useRoute, useRouter } from "vue-router"
import { computed } from "vue"
import { useIdeas } from "@/modules/projects/webview"
import { getLevelColor } from "@/modules/projects/composables/useLevelColor"

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const projectId = computed(() => route.params.id as string)

const { ideas } = useIdeas(projectId)

function goToIdeas() {
  router.push(`/project/${projectId.value}/ideas`)
}
</script>

<template>
  <div class="flex h-full flex-col p-6">
    <!-- Stats cards -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <button
        class="flex flex-col gap-2 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-elevated)] p-5 text-left transition-colors hover:border-[var(--ui-primary)] hover:bg-[var(--ui-bg-elevated)]/80"
        @click="goToIdeas"
      >
        <div class="flex items-center gap-2 text-[var(--ui-text-muted)]">
          <UIcon name="i-lucide-lightbulb" class="h-4 w-4" />
          <span class="text-sm font-medium">{{ t("projects.ideas") }}</span>
        </div>
        <span class="text-3xl font-bold">{{ ideas.length }}</span>
      </button>
    </div>

    <!-- Recent ideas -->
    <div v-if="ideas.length > 0" class="mt-8">
      <h3 class="mb-3 text-sm font-medium text-[var(--ui-text-muted)]">
        {{ t("projects.recentIdeas") }}
      </h3>
      <div class="flex flex-col gap-2">
        <RouterLink
          v-for="idea in ideas.slice(0, 5)"
          :key="idea.id"
          :to="`/project/${projectId}/ideas/${idea.id}`"
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
            <span v-if="idea.type" class="text-xs text-[var(--ui-text-muted)]">{{
              idea.type
            }}</span>
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
  </div>
</template>
