<script setup lang="ts">
import { useRoute, useRouter } from "vue-router"

const route = useRoute()
const router = useRouter()
</script>

<template>
  <div class="flex h-full flex-col">
    <div
      class="flex h-12 flex-shrink-0 items-center justify-between border-b border-[var(--ui-border)] px-6"
    >
      <RouterLink
        :to="`/project/${route.params.projectId}/overview`"
        class="text-lg font-semibold transition-colors hover:text-[var(--ui-primary)]"
        >{{ project.name }}</RouterLink
      >
      <nav class="flex items-center gap-1">
        <RouterLink
          :to="`/project/${route.params.projectId}/overview`"
          class="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
        >
          <UIcon name="i-lucide-layout-grid" class="h-4 w-4" />
          Overview
        </RouterLink>
        <RouterLink
          :to="`/project/${route.params.projectId}/ideas`"
          class="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
        >
          <UIcon name="i-lucide-lightbulb" class="h-4 w-4" />
          Ideas
        </RouterLink>
        <RouterLink
          :to="`/project/${route.params.projectId}/settings`"
          class="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
        >
          <UIcon name="i-lucide-settings" class="h-4 w-4" />
          Settings
        </RouterLink>
      </nav>
    </div>
    <div class="flex-1 overflow-hidden">
      <RouterView />
    </div>
  </div>
</template>
