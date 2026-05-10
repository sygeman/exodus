<script setup lang="ts">
import { computed, watch } from "vue"
import { useI18n } from "vue-i18n"
import { useColorMode } from "@vueuse/core"
import { edemBridge } from "@/edem-bridge"

const { t } = useI18n({
  messages: {
    en: {
      "Dark mode": "Dark mode",
      "Use a dark color scheme.": "Use a dark color scheme.",
    },
    ru: {
      "Dark mode": "Тёмная тема",
      "Use a dark color scheme.": "Использовать тёмную цветовую схему.",
    },
  },
})

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

const themeDescription = computed(() => t("Use a dark color scheme."))
</script>

<template>
  <section class="flex flex-col gap-8">
    <div class="flex items-start justify-between gap-4">
      <div class="flex flex-col gap-1">
        <h3 class="text-base font-medium">{{ t("Dark mode") }}</h3>
        <p class="text-sm text-[var(--ui-text-muted)]">{{ themeDescription }}</p>
      </div>
      <div class="flex items-center">
        <USwitch v-model="isDark" />
      </div>
    </div>
  </section>
</template>
