<script setup lang="ts">
import { useRouter } from "vue-router"

const router = useRouter()

function handleNavigateprojects() {
  router.push("/projects")
}
</script>

<template>
  <div class="flex items-center justify-between border-b border-[var(--ui-border)] px-4 py-2">
    <div class="flex items-center gap-2">
      <UButton
        variant="ghost"
        size="sm"
        icon="i-lucide-arrow-left"
        @click="handleNavigateprojects()"
      />
    </div>
    <div class="flex items-center gap-2">
      <span class="text-muted text-xs">v0.42.0</span>
    </div>
  </div>
</template>
