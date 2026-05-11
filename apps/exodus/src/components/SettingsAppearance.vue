<script setup lang="ts">
import { computed, watch } from "vue"
import { useT } from "@exodus/edem-vue"
import { useColorMode } from "@vueuse/core"
import { edemBridge } from "@/edem-bridge"

const t = useT()

const colorMode = useColorMode()

const isDark = computed({
  get() {
    return colorMode.value === "dark"
  },
  set(_isDark: boolean) {
    colorMode.store.value = _isDark ? "dark" : "light"
  },
})

watch(isDark, (value) => {
  edemBridge.emitEvent("app-state:setting-changed", {
    key: "theme",
    value: value ? "dark" : "light",
  })
})
</script>

<template>
  <section class="flex flex-col gap-8">
    <div class="flex items-start justify-between gap-4">
      <div class="flex flex-col gap-1">
        <h3 class="text-base font-medium">
          {{ t({ en: "Dark mode", ru: "Тёмная тема" }) }}
        </h3>
        <p class="text-sm text-[var(--ui-text-muted)]">
          {{ t({ en: "Use a dark color scheme.", ru: "Использовать тёмную цветовую схему." }) }}
        </p>
      </div>
      <div class="flex items-center">
        <USwitch v-model="isDark" />
      </div>
    </div>
  </section>
</template>
