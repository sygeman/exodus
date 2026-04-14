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

const currentLocale = computed(() => locales.find((l) => l.value === locale.value) ?? locales[0])

function setLocale(value: string) {
  locale.value = value as any
}

const localeItems = computed(() =>
  locales.map((l) => ({
    label: `${l.flag} ${l.label}`,
    value: l.value,
    onSelect: () => setLocale(l.value),
  }))
)

const appVersion = __APP_VERSION__
</script>

<template>
  <div class="p-8 flex flex-col items-center gap-6">
    <h1 class="text-2xl font-bold">{{ t("common.settings") }}</h1>

    <div class="w-full max-w-sm flex flex-col gap-4">
      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-2">
          <UIcon :name="themeIcon" class="w-5 h-5 text-[var(--ui-text-muted)]" />
          <span class="text-sm">{{ themeText }}</span>
        </div>
        <USwitch v-model="isDark" />
      </div>

      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-globe" class="w-5 h-5 text-[var(--ui-text-muted)]" />
          <span class="text-sm">{{ t("common.language") }}</span>
        </div>
        <UDropdownMenu :items="localeItems">
          <UButton variant="soft" size="sm" trailing-icon="i-lucide-chevron-down">
            {{ currentLocale.flag }} {{ currentLocale.label }}
          </UButton>
        </UDropdownMenu>
      </div>

      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-info" class="w-5 h-5 text-[var(--ui-text-muted)]" />
          <span class="text-sm">{{ t("common.version") }}</span>
        </div>
        <span class="text-sm text-[var(--ui-text-muted)] font-mono">{{ appVersion }}</span>
      </div>
    </div>
  </div>
</template>
