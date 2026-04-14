<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "vue-i18n"
import { useColorMode } from "@vueuse/core"
import { locales } from "@/mainview/locales"

const { t, locale } = useI18n()

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
const themeText = computed(() => (isDark.value ? t("common.lightMode") : t("common.darkMode")))

const currentLocaleLabel = computed(() => locales.find((l) => l.value === locale.value)?.label ?? locale.value)
function switchLocale() {
  const next = locales[(locales.findIndex((l) => l.value === locale.value) + 1) % locales.length]
  locale.value = next.value
}

const appVersion = __APP_VERSION__
</script>

<template>
  <div class="p-6 max-w-xl">
    <h1 class="text-2xl font-bold mb-6">{{ t("common.settings") }}</h1>

    <div class="space-y-4">
      <div class="flex items-center justify-between p-4 rounded-lg border border-[var(--ui-border)]">
        <div class="flex items-center gap-3">
          <UIcon :name="themeIcon" class="w-5 h-5 text-[var(--ui-text-muted)]" />
          <span>{{ themeText }}</span>
        </div>
        <USwitch v-model="isDark" />
      </div>

      <div class="flex items-center justify-between p-4 rounded-lg border border-[var(--ui-border)]">
        <div class="flex items-center gap-3">
          <UIcon name="i-lucide-globe" class="w-5 h-5 text-[var(--ui-text-muted)]" />
          <span>{{ t("common.language") }}</span>
        </div>
        <UButton variant="soft" size="sm" @click="switchLocale">
          {{ currentLocaleLabel }}
        </UButton>
      </div>

      <div class="flex items-center justify-between p-4 rounded-lg border border-[var(--ui-border)]">
        <div class="flex items-center gap-3">
          <UIcon name="i-lucide-info" class="w-5 h-5 text-[var(--ui-text-muted)]" />
          <span>{{ t("common.version") }}</span>
        </div>
        <span class="text-sm text-[var(--ui-text-muted)] font-mono">{{ appVersion }}</span>
      </div>
    </div>
  </div>
</template>
