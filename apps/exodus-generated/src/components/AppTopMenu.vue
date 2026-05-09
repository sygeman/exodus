<script setup lang="ts">
import { useRouter } from "vue-router"

const router = useRouter()

function handleNavigateback() {
  router.back()
}

function handleNavigateforward() {
  router.forward()
}
</script>

<template>
  <div
    class="electrobun-webkit-app-region-drag flex h-8 items-center justify-between px-3 select-none"
  >
    <div class="electrobun-webkit-app-region-no-drag flex items-center select-none">
      <button
        class="flex h-6 w-6 items-center justify-center rounded text-[var(--ui-text-muted)] transition-colors hover:bg-[var(--ui-bg)] hover:text-[var(--ui-text)]"
        @click="handleNavigateback()"
      >
        <UIcon name="i-lucide-arrow-left" class="h-3.5 w-3.5" />
      </button>
      <button
        class="flex h-6 w-6 items-center justify-center rounded text-[var(--ui-text-muted)] transition-colors hover:bg-[var(--ui-bg)] hover:text-[var(--ui-text)]"
        @click="handleNavigateforward()"
      >
        <UIcon name="i-lucide-arrow-right" class="h-3.5 w-3.5" />
      </button>
    </div>
    <div class="electrobun-webkit-app-region-no-drag flex items-center gap-2 select-none">
      <RouterLink
        to="/debug"
        class="flex h-6 w-6 items-center justify-center rounded text-[var(--ui-text-muted)] transition-colors hover:bg-[var(--ui-bg)] hover:text-[var(--ui-text)]"
        active-class="bg-[var(--ui-bg)] text-[var(--ui-text)]"
      >
        <UIcon name="i-lucide-bug" class="h-3.5 w-3.5" />
      </RouterLink>
      <div class="flex items-center select-text">
        <UBadge color="neutral" variant="subtle" size="sm">v0.42.0</UBadge>
      </div>
    </div>
  </div>
</template>
