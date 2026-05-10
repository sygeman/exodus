<script setup lang="ts">
import { useT } from "@/composables/useT"

const t = useT()
</script>

<template>
  <div
    class="flex h-full flex-col items-center justify-center gap-4 p-6 text-[var(--ui-text-muted)]"
  >
    <UIcon name="i-lucide-ghost" class="h-16 w-16 opacity-20" />
    <div class="text-center">
      <h1 class="text-2xl font-bold text-[var(--ui-text)]">
        {{ t({ en: "Page not found", ru: "Страница не найдена" }) }}
      </h1>
      <p class="mt-2 text-sm opacity-60">
        {{
          t({
            en: "The page you're looking for doesn't exist.",
            ru: "Страница, которую вы ищете, не существует.",
          })
        }}
      </p>
    </div>
    <UButton to="/projects" color="primary">
      {{ t({ en: "Back to projects", ru: "Назад к проектам" }) }}
    </UButton>
  </div>
</template>
