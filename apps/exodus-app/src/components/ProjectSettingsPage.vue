<script setup lang="ts">
import { useRoute } from "vue-router"
import { useProjects } from "@/composables/useProjects"
import { useEdem } from "@/edem"

const route = useRoute()
const {
  items: projects,
  update: updateProjects,
  remove: removeProjects,
} = useProjects({ filter: { id: { _eq: route.params.id } } })
const edem = useEdem()

function handleUpdateProjects(v: unknown) {
  const data = { id: route.params.projectId, color: item }
  updateProjects(data.id as string, data)
}

function handleDeleteProject() {
  edem.flows.trigger({ flow_id: "deleteProject", projectId: route.params.projectId })
}
</script>

<template>
  <div class="overflow-y-auto p-10">
    <h1 class="mb-6 text-lg font-bold">Settings</h1>
    <section>
      <div class="border-b py-4">
        <div class="mb-2">
          <h3 class="font-medium">Name</h3>
          <p class="text-muted text-sm">Display name of the project</p>
        </div>
        <UInput
          :model-value="item.name"
          class="max-w-md"
          @update:model-value="handleUpdateProjects($event)"
        />
      </div>
      <div class="border-b py-4">
        <div class="mb-2">
          <h3 class="font-medium">Color</h3>
          <p class="text-muted text-sm">Project color for sidebar</p>
        </div>
        <div
          class="flex gap-2"
          v-for="(item, idx) in [
            '#ef4444',
            '#f97316',
            '#eab308',
            '#22c55e',
            '#06b6d4',
            '#3b82f6',
            '#8b5cf6',
            '#ec4899',
          ]"
          :key="idx"
        >
          <button class="h-6 w-6 rounded-full transition-all" :style="{ backgroundColor: item }" />
        </div>
      </div>
      <div class="py-4">
        <div class="mb-2">
          <h3 class="text-error font-medium">Delete project</h3>
          <p class="text-muted text-sm">Permanently delete this project and all its ideas.</p>
        </div>
        <UButton color="error" variant="outline" @click="handleDeleteProject()">
          <UIcon name="i-lucide-trash-2" />
          <span>Delete</span>
        </UButton>
      </div>
    </section>
  </div>
</template>
