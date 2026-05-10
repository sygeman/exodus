<script setup lang="ts">
import { useI18n } from "vue-i18n"

const { t } = useI18n()
</script>

<template>
  <div
    class="flex h-full flex-col items-center justify-center gap-4 p-6 text-[var(--ui-text-muted)]"
  >
    <UIcon name="i-lucide-ghost" class="h-16 w-16 opacity-20" />
    <div class="text-center">
      <h1 class="text-2xl font-bold text-[var(--ui-text)]">{{ t("notFound.title") }}</h1>
      <p class="mt-2 text-sm opacity-60">{{ t("notFound.description") }}</p>
    </div>
    <UButton to="/projects" color="primary">{{ t("notFound.backHome") }}</UButton>
  </div>
</template>
