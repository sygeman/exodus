<script setup lang="ts">
import { useRoute, useRouter } from "vue-router"
import { useIdeas } from "@/composables/useIdeas"

const route = useRoute()
const {
  items: ideas,
  update: updateIdeas,
  remove: removeIdeas,
} = useIdeas({ filter: { id: { _eq: route.params.id } } })
const router = useRouter()

function handleNavigateproject_context_projectId_ideas() {
  router.push(`/project/${route.params.projectId}/ideas`)
}

function handleDeleteIdeas() {
  removeIdeas(route.params.id)
}

function handleUpdateIdeas(v: unknown) {
  const data = { id: route.params.ideaId, status: v }
  updateIdeas(data.id as string, data)
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex items-center justify-between border-b px-6 py-3">
      <div class="flex items-center gap-3">
        <UButton
          variant="ghost"
          size="sm"
          icon="i-lucide-arrow-left"
          @click="handleNavigateproject_context_projectId_ideas()"
        />
        <UBadge color="neutral" variant="subtle">{{ item.level }}</UBadge>
        <UBadge color="neutral" variant="soft" size="sm">{{ item.type }}</UBadge>
      </div>
      <UButton
        color="error"
        variant="ghost"
        size="sm"
        icon="i-lucide-trash-2"
        @click="handleDeleteIdeas()"
      />
    </div>
    <div class="flex-1 overflow-y-auto px-6 pb-6">
      <UInput
        :model-value="item.title"
        size="lg"
        class="mb-4 w-full"
        @update:model-value="handleUpdateIdeas($event)"
      />
      <UTextarea
        :model-value="item.description"
        :rows="6"
        placeholder="Describe this idea..."
        class="mb-6 w-full"
        @update:model-value="handleUpdateIdeas($event)"
      />
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label class="mb-1 block text-sm font-medium">Level</label>
          <USelect
            :model-value="item.level"
            :items="['L0', 'L1', 'L2', 'L3', 'L4']"
            size="sm"
            class="w-full"
            @update:model-value="handleUpdateIdeas($event)"
          />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium">Type</label>
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
        <div>
          <label class="mb-1 block text-sm font-medium">Status</label>
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
</template>
