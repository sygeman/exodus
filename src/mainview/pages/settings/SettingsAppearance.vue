<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "vue-i18n"
import { useColorMode } from "@vueuse/core"

const { t } = useI18n()

const colorMode = useColorMode()

const isDark = computed({
  get() {
    return colorMode.value === "dark"
  },
  set(_isDark: boolean) {
    colorMode.store.value = _isDark ? "dark" : "light"
  },
})

const themeIcon = computed(() => (isDark.value ? "i-lucide-sun" : "i-lucide-moon"))
const themeDescription = computed(() =>
  isDark.value ? t("settings.darkModeDescription") : t("settings.lightModeDescription"),
)
</script>

<template>
  <section class="flex flex-col gap-8">
    <div class="flex items-start justify-between gap-4 border-b border-[var(--ui-border)] pb-8">
      <div class="flex flex-col gap-1">
        <h3 class="text-base font-medium">{{ t("settings.theme") }}</h3>
        <p class="text-sm text-[var(--ui-text-muted)]">{{ themeDescription }}</p>
      </div>
      <div class="flex items-center gap-3">
        <UIcon :name="themeIcon" class="h-5 w-5 text-[var(--ui-text-muted)]" />
        <USwitch v-model="isDark" />
      </div>
    </div>
  </section>
</template>
