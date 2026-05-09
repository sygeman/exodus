<script setup lang="ts">
import { useProjects } from "@/composables/useProjects"
import { useEdem } from "@/edem"

const { items: projects, update: updateProjects, remove: removeProjects } = useProjects()
const edem = useEdem()

function handleCreateProject() {
  edem.flows.trigger({ flow_id: "createProject" })
}
</script>

<template>
  <div class="flex h-full flex-col p-6">
    <div class="mb-4 flex items-center gap-2">
      <h1 class="text-lg font-bold">Projects</h1>
      <UBadge color="neutral" variant="subtle" v-for="item in projects" :key="item.id">
        <span>{{ item.projects.length }}</span>
      </UBadge>
    </div>
    <UButton size="sm" @click="handleCreateProject()">
      <UIcon name="i-lucide-plus" />
      <span>New project</span>
    </UButton>
    <UScrollArea class="mt-4 flex-1" v-for="item in projects" :key="item.id">
      <div
        class="hover:bg-elevated flex items-center gap-3 rounded-lg border p-3 transition-colors"
      >
        <div
          class="text-inverted flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold"
          :style="{ backgroundColor: item.color }"
        >
          {{ item.name }}
        </div>
        <div class="flex flex-col">
          <span class="font-medium">{{ item.name }}</span>
          <span class="text-muted text-sm">{{ item.idea_count }} ideas</span>
        </div>
      </div>
    </UScrollArea>
  </div>
</template>
