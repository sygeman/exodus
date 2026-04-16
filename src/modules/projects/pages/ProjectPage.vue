<script setup lang="ts">
import { useI18n } from "vue-i18n"

const { t } = useI18n()
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center p-6 text-[var(--ui-text-muted)]">
    <UIcon name="i-lucide-layout-grid" class="h-16 w-16 opacity-20" />
    <p class="mt-4 text-lg font-medium">{{ t("projects.emptyBoard") }}</p>
    <p class="mt-1 text-sm opacity-60">{{ t("projects.emptyBoardDescription") }}</p>
  </div>
</template>
