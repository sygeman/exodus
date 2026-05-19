<script setup lang="ts">
import { useApp_state } from "@/composables/useApp_state"
import { useT } from "@exodus/edem-vue"

const { item: appState, loading: appStateLoading, update: updateApp_state } = useApp_state()
const t = useT()

async function updateDarkMode($event?: Event, item?: Record<string, unknown>) {
  await updateApp_state({ dark: $event })
}
</script>

<template>
  <section class="flex flex-col gap-8">
    <div class="flex items-start justify-between gap-4">
      <div class="flex flex-col gap-1">
        <h3 class="text-base font-medium">{{ t({ en: "Dark mode", ru: "Тёмная тема" }) }}</h3>
        <p class="text-muted text-sm">
          {{ t({ en: "Use a dark color scheme.", ru: "Использовать тёмную цветовую схему." }) }}
        </p>
      </div>
      <div class="flex items-center">
        <USwitch :model-value="!!appState?.dark" @update:model-value="updateDarkMode($event)" />
      </div>
    </div>
  </section>
</template>
