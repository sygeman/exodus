<script setup lang="ts">
import { useProjects } from "@/composables/useProjects"
import { useEdem } from "@/edem"

const { items: projects, loading, update: updateProjects, remove: removeProjects } = useProjects()
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
  <div class="flex h-full">
    <div
      class="flex h-full flex-col items-center justify-center gap-2 text-[var(--ui-text-muted)]"
      v-if="!project"
    >
      <UIcon name="i-lucide-folder-x" class="h-10 w-10" />
      <p>Project not found</p>
      <UButton to="/projects" variant="link">Back to list</UButton>
    </div>
    <MenuLayout title="Settings" :items="navItems" main-class="overflow-y-auto p-10">
      <template #default>
        <div class="w-full">
          <h1 class="mb-8 text-2xl font-bold">Settings</h1>
          <section class="flex flex-col gap-8">
            <div class="flex flex-col gap-4 border-b border-[var(--ui-border)] pb-8">
              <div class="flex flex-col gap-1">
                <h3 class="text-base font-medium">Name</h3>
                <p class="text-sm text-[var(--ui-text-muted)]">Display name of the project</p>
              </div>
              <UInput
                :model-value="project.name"
                class="max-w-md"
                @update:model-value="handleUpdateProjects($event)"
              />
            </div>
            <div class="flex flex-col gap-4 border-b border-[var(--ui-border)] pb-8">
              <div class="flex flex-col gap-1">
                <h3 class="text-base font-medium">Color</h3>
                <p class="text-sm text-[var(--ui-text-muted)]">Project color for sidebar</p>
              </div>
              <div
                class="flex flex-wrap gap-2"
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
                <button
                  class="h-8 w-8 rounded-full transition-transform hover:scale-110 focus:ring-2 focus:ring-[var(--ui-primary)] focus:outline-none"
                  :style="`background-color: ${item}`"
                />
              </div>
            </div>
            <div>
              <h3 class="mb-2 text-base font-medium text-[var(--ui-error)]">Delete project</h3>
              <p class="mb-4 text-sm text-[var(--ui-text-muted)]">
                Permanently delete this project and all its ideas.
              </p>
              <UButton color="error" variant="outline" @click="handleDeleteProject()">
                <UIcon name="i-lucide-trash-2" class="h-4 w-4" />
                <span class="ml-2">Delete</span>
              </UButton>
            </div>
          </section>
        </div>
      </template>
    </MenuLayout>
  </div>
</template>
