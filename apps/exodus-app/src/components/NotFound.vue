<script setup lang="ts">
import { useRoute } from "vue-router"

const route = useRoute()
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center gap-4">
    <UIcon name="i-lucide-ghost" class="h-16 opacity-20" />
    <div class="text-center">
      <h1 class="text-lg font-bold">Page not found</h1>
      <p class="text-muted">The page you're looking for doesn't exist.</p>
    </div>
    <UButton to="/projects" color="primary">Go to projects</UButton>
  </div>
</template>
