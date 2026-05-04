<script setup lang="ts">
import { computed, watch } from "vue"
import { useI18n } from "vue-i18n"
import { useColorMode } from "@vueuse/core"
import { saveAppSettings } from "@/modules/app-state/settings"

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

watch(isDark, (value) => {
  saveAppSettings({ theme: value ? "dark" : "light" }).catch(() => {})
})

const themeDescription = computed(() => t("settings.darkModeDescription"))
</script>

<template>
  <section class="flex flex-col gap-8">
    <div class="flex items-start justify-between gap-4">
      <div class="flex flex-col gap-1">
        <h3 class="text-base font-medium">{{ t("common.darkMode") }}</h3>
        <p class="text-sm text-[var(--ui-text-muted)]">{{ themeDescription }}</p>
      </div>
      <div class="flex items-center">
        <USwitch v-model="isDark" />
      </div>
    </div>
  </section>
</template>
