<script setup lang="ts">
import { useProjects } from "@/composables/useProjects"
import { useEdem } from "@/edem"

const { items: projects, loading, update: updateProjects, remove: removeProjects } = useProjects()
const edem = useEdem()

function handleCreateProject() {
  edem.flows.trigger({ flow_id: "createProject" })
}
</script>

<template>
  <div class="flex h-full flex-col p-8">
    <div class="flex flex-1 flex-col gap-4" v-if="loading && showSkeleton">
      <div class="mb-4 flex items-center justify-between">
        <USkeleton class="h-8 w-40" />
        <USkeleton class="h-9 w-32" />
      </div>
      <div v-for="(item, idx) in [1, 2, 3, 4, 5]" :key="idx">
        <div class="flex items-center gap-4 rounded-lg border border-[var(--ui-border)] p-4">
          <USkeleton class="h-10 w-10 flex-shrink-0 rounded-lg" />
          <USkeleton class="h-5 w-48" />
        </div>
      </div>
    </div>
    <div
      class="flex flex-1 flex-col items-center justify-center gap-4"
      v-else-if="!loading && projects.length === 0"
    >
      <UIcon name="i-lucide-folder-open" class="h-12 w-12 text-[var(--ui-text-muted)]" />
      <p class="text-lg text-[var(--ui-text-muted)]">No projects yet</p>
      <UButton @click="handleCreateProject()">Create project</UButton>
    </div>
    <div class="flex flex-col gap-2" v-else>
      <div class="mb-4 flex items-center justify-between">
        <h1 class="text-2xl font-bold">Projects</h1>
        <UButton @click="handleCreateProject()">New project</UButton>
      </div>
      <RouterLink v-for="item in projects" :key="item.id">
        <RouterLink
          :to="`/project/${item.id}/overview`"
          class="flex items-center gap-4 rounded-lg border border-[var(--ui-border)] p-4 transition-colors hover:bg-[var(--ui-bg-elevated)]"
        >
          <div
            class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border-2 border-solid bg-[var(--ui-bg-elevated)] font-semibold"
            :style="`color: ${item.color}; border-color: ${item.color}`"
          >
            {{ item.name }}
          </div>
          <span class="font-medium">{{ item.name }}</span>
        </RouterLink>
      </RouterLink>
    </div>
  </div>
</template>
