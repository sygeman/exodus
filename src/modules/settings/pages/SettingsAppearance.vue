<script setup lang="ts">
import { computed, watch } from "vue"
import { useI18n } from "vue-i18n"
import { useColorMode } from "@vueuse/core"
import { evento } from "@/mainview/evento"

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
  evento.emitEvent("app-state:save-settings", { theme: value ? "dark" : "light" }, "webview")
})

const themeIcon = computed(() => (isDark.value ? "i-lucide-sun" : "i-lucide-moon"))
const themeDescription = computed(() => t("settings.darkModeDescription"))
</script>

<template>
  <section class="flex flex-col gap-8">
    <div class="flex items-start justify-between gap-4 border-b border-[var(--ui-border)] pb-8">
      <div class="flex flex-col gap-1">
        <h3 class="text-base font-medium">{{ t("common.darkMode") }}</h3>
        <p class="text-sm text-[var(--ui-text-muted)]">{{ themeDescription }}</p>
      </div>
      <div class="flex items-center gap-3">
        <UIcon :name="themeIcon" class="h-5 w-5 text-[var(--ui-text-muted)]" />
        <USwitch v-model="isDark" />
      </div>
    </div>
  </section>
</template>
