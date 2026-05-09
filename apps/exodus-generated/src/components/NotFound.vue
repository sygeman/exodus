<script setup lang="ts">
import { useRoute } from "vue-router"

const route = useRoute()
</script>

<template>
  <div
    class="flex h-full flex-col items-center justify-center gap-4 p-6 text-[var(--ui-text-muted)]"
  >
    <UIcon name="i-lucide-ghost" class="h-16 w-16 opacity-20" />
    <div class="text-center">
      <h1 class="text-2xl font-bold text-[var(--ui-text)]">Page not found</h1>
      <p class="mt-2 text-sm opacity-60">The page you're looking for doesn't exist.</p>
    </div>
    <UButton to="/projects" color="primary">Go to projects</UButton>
  </div>
</template>
