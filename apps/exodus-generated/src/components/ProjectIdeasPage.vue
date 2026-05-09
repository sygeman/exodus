<script setup lang="ts">
import { ref } from "vue"
import { useRouter } from "vue-router"
import { useIdeas } from "@/composables/useIdeas"
import { useEdem } from "@/edem"

const { items: ideas, loading, update: updateIdeas, remove: removeIdeas } = useIdeas()
const showSkeleton = ref(false)
const edem = useEdem()
const router = useRouter()

function handleCreateIdea() {
  edem.flows.trigger({ flow_id: "createIdea", projectId: route.params.projectId })
}

function getLevelColor(level: string): string {
  const colors: Record<string, string> = {
    L0: "#22c55e",
    L1: "#06b6d4",
    L2: "#eab308",
    L3: "#f97316",
    L4: "#ef4444",
  }
  return colors[level] ?? "#6b7280"
}
</script>

<template>
  <div class="flex h-full flex-col p-6">
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-lg font-semibold">Ideas</h2>
      <UButton size="sm" @click="handleCreateIdea()">
        <UIcon name="i-lucide-plus" class="h-4 w-4" />
        New Idea
      </UButton>
    </div>
    <div class="flex flex-1 flex-col gap-4">
      <div class="mb-4 flex items-center justify-between">
        <USkeleton class="h-8 w-40" />
        <USkeleton class="h-9 w-32" />
      </div>
      <div
        v-for="i in 5"
        :key="i"
        class="flex items-center gap-4 rounded-lg border border-[var(--ui-border)] p-4"
      >
        <USkeleton class="h-10 w-10 flex-shrink-0 rounded-lg" />
        <USkeleton class="h-5 w-48" />
      </div>
    </div>
    <div class="flex flex-1 flex-col items-center justify-center gap-4">
      <UIcon name="i-lucide-lightbulb" class="h-12 w-12 text-[var(--ui-text-muted)]" />
      <p class="text-lg text-[var(--ui-text-muted)]">No ideas yet</p>
      <UButton size="sm" @click="handleCreateIdea()">Create first idea</UButton>
    </div>
  </div>
</template>
