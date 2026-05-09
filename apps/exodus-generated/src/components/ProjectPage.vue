<script setup lang="ts">
import { useRouter } from "vue-router"
import { useIdeas } from "@/composables/useIdeas"

const { items: ideas, loading, update: updateIdeas, remove: removeIdeas } = useIdeas()
const router = useRouter()

function handleNavigateproject_projectId_ideas() {
  router.push(`/project/${route.params.projectId}/ideas`)
}

function getLevelColor(level: string): string {
  const colors: Record<string, string> = { L0: "#22c55e", L1: "#06b6d4", L2: "#eab308", L3: "#f97316", L4: "#ef4444" }
  return colors[level] ?? "#6b7280"
}
</script>

<template>
  <div class="flex h-full flex-col p-6">
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <button class="flex flex-col gap-2 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-elevated)] p-5 text-left transition-colors hover:border-[var(--ui-primary)] hover:bg-[var(--ui-bg-elevated)]/80" @click="handleNavigateproject_projectId_ideas()">
        <div class="flex items-center gap-2 text-[var(--ui-text-muted)]">
          <UIcon name="i-lucide-lightbulb" class="h-4 w-4" />
          <span class="text-sm font-medium">Ideas</span>
        </div>
        <span class="text-3xl font-bold">{{ ideas.length }}</span>
      </button>
    </div>
    <h3 class="mt-8 mb-3 text-sm font-medium text-[var(--ui-text-muted)]">Recent Ideas</h3>
    <div class="flex flex-col gap-2" v-for="item in ideas" :key="item.id">
      <RouterLink :to="`/project/${route.params.projectId}/ideas/${item.id}`" class="flex items-center gap-3 rounded-lg border border-[var(--ui-border)] p-4 transition-colors hover:bg-[var(--ui-bg-elevated)]">
        <div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded text-xs font-bold" :style="`background-color: ${getLevelColor(item.level) + '20'}; color: ${getLevelColor(item.level)}`">{{ item.level ?? '?' }}</div>
        <div class="flex flex-col">
          <span class="font-medium">{{ item.title }}</span>
          <span class="text-xs text-[var(--ui-text-muted)]">{{ item.type }}</span>
        </div>
      </RouterLink>
    </div>
  </div>
</template>
