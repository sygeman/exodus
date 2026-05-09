<script setup lang="ts">

</script>

<template>
  <Teleport to="body">
    <div>
      <Transition>
        <Transition>
          <div role="status" aria-live="polite" class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[var(--ui-bg)]/95" v-if="isUpdating">
            <div class="mb-8 flex items-center justify-center">
              <div class="relative">
                <div class="flex h-16 w-16 animate-pulse items-center justify-center rounded-2xl bg-[var(--ui-primary)]/10">
                  <UIcon name="i-lucide-arrow-up-circle" class="h-8 w-8 text-[var(--ui-primary)]" />
                </div>
                <div class="absolute inset-0 h-16 w-16 animate-ping rounded-2xl bg-[var(--ui-primary)]/20" />
              </div>
            </div>
            <h2 class="mb-6 text-xl font-semibold text-[var(--ui-text)]">Updating...</h2>
            <div class="flex items-center gap-3">
              <span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--ui-border)] border-t-[var(--ui-primary)]" />
              <span class="text-sm font-medium text-[var(--ui-text)]">{{ statusText }}</span>
            </div>
          </div>
        </Transition>
      </Transition>
    </div>
  </Teleport>
</template>
