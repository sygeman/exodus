<script setup lang="ts">
import { computed } from "vue"
import { useRoute, useRouter } from "vue-router"
import { useIdeas } from "@/composables/useIdeas"

const route = useRoute()
const { items: ideas, loading, update: updateIdeas, remove: removeIdeas } = useIdeas()
const ideaId = computed(() => route.params.ideaId)
const router = useRouter()

function handleNavigateproject_projectId_ideas() {
  router.push(`/project/${route.params.projectId}/ideas`)
}

function handleDeleteIdeas() {
  removeIdeas(route.params.ideaId)
}

function handleUpdateIdeas(v: unknown) {
  const data = { id: route.params.ideaId, status: v }
  updateIdeas(data.id as string, data)
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex h-full items-center justify-center" v-if="loading">
      <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-[var(--ui-text-muted)]" />
    </div>
    <div
      class="flex h-full flex-col items-center justify-center gap-2 text-[var(--ui-text-muted)]"
      v-else-if="!idea"
    >
      <UIcon name="i-lucide-file-x" class="h-12 w-12 opacity-20" />
      <p>Idea not found</p>
      <UButton :to="`/project/${route.params.projectId}/ideas`" variant="link"
        >Back to ideas</UButton
      >
    </div>
    <div class="flex flex-1 flex-col gap-6 overflow-y-auto" v-else>
      <div class="flex items-center justify-between border-b border-[var(--ui-border)] px-6 py-3">
        <div class="flex items-center gap-3">
          <UButton
            variant="ghost"
            size="sm"
            icon="i-lucide-arrow-left"
            @click="handleNavigateproject_projectId_ideas()"
          />
          <div class="flex flex-wrap items-center gap-2">
            <UBadge color="neutral" variant="subtle">{{ item.level }}</UBadge>
            <UBadge color="neutral" variant="soft" size="sm">{{ item.type }}</UBadge>
          </div>
        </div>
        <UButton
          color="error"
          variant="ghost"
          size="sm"
          icon="i-lucide-trash-2"
          @click="handleDeleteIdeas()"
        />
      </div>
      <div class="flex flex-col gap-6 px-6 pb-6">
        <UInput
          :model-value="item.title"
          size="lg"
          class="w-full"
          @update:model-value="handleUpdateIdeas($event)"
        />
        <UTextarea
          :model-value="item.description"
          :rows="6"
          placeholder="Describe this idea..."
          class="w-full"
          @update:model-value="handleUpdateIdeas($event)"
        />
        <div class="grid grid-cols-3 gap-4">
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-[var(--ui-text-muted)]">Level</label>
            <USelect
              :model-value="item.level"
              :items="['L0', 'L1', 'L2', 'L3', 'L4']"
              size="sm"
              class="w-full"
              @update:model-value="handleUpdateIdeas($event)"
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-[var(--ui-text-muted)]">Type</label>
            <USelect
              :model-value="item.type"
              :items="[
                'goal',
                'non_goal',
                'constraint',
                'invariant',
                'component',
                'decision',
                'principle',
              ]"
              size="sm"
              class="w-full"
              @update:model-value="handleUpdateIdeas($event)"
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-[var(--ui-text-muted)]">Status</label>
            <USelect
              :model-value="item.status"
              :items="['draft', 'active', 'stabilized', 'archived']"
              size="sm"
              class="w-full"
              @update:model-value="handleUpdateIdeas($event)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
