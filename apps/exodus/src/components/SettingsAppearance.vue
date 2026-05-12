<script setup lang="ts">
import { computed } from "vue"
import { useT } from "@exodus/edem-vue"
import { useSingleton } from "@/hooks"

const t = useT()

const { data: appState, update: updateSetting } = useSingleton("app_state")

const isDark = computed({
  get() {
    return !!appState.value?.data.dark
  },
  set(_isDark: boolean) {
    updateSetting({ dark: _isDark })
  },
})
</script>

<template>
  <section class="flex flex-col gap-8">
    <div class="flex items-start justify-between gap-4">
      <div class="flex flex-col gap-1">
        <h3 class="text-base font-medium">
          {{ t({ en: "Dark mode", ru: "Тёмная тема" }) }}
        </h3>
        <p class="text-muted text-sm">
          {{ t({ en: "Use a dark color scheme.", ru: "Использовать тёмную цветовую схему." }) }}
        </p>
      </div>
      <div class="flex items-center">
        <USwitch v-model="isDark" />
      </div>
    </div>
  </section>
</template>
