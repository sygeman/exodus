<script setup lang="ts">
import { useI18n } from "vue-i18n"

const { t } = useI18n({
  messages: {
    en: {
      "Page not found": "Page not found",
      "The page you're looking for doesn't exist.": "The page you're looking for doesn't exist.",
      "Back to projects": "Back to projects",
    },
    ru: {
      "Page not found": "Страница не найдена",
      "The page you're looking for doesn't exist.": "Страница, которую вы ищете, не существует.",
      "Back to projects": "Назад к проектам",
    },
  },
})
</script>

<template>
  <div
    class="flex h-full flex-col items-center justify-center gap-4 p-6 text-[var(--ui-text-muted)]"
  >
    <UIcon name="i-lucide-ghost" class="h-16 w-16 opacity-20" />
    <div class="text-center">
      <h1 class="text-2xl font-bold text-[var(--ui-text)]">{{ t("Page not found") }}</h1>
      <p class="mt-2 text-sm opacity-60">
        {{ t("The page you're looking for doesn't exist.") }}
      </p>
    </div>
    <UButton to="/projects" color="primary">{{ t("Back to projects") }}</UButton>
  </div>
</template>
