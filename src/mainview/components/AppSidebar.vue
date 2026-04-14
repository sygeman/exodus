<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "vue-i18n"
import { useColorMode } from "@vueuse/core"
import LogoSvg from "@/mainview/assets/logo.svg"
import { locales } from "@/mainview/locales"

const emit = defineEmits<{
  (e: "open-events"): void
  (e: "open-logs"): void
}>()

const { t, locale } = useI18n()

const tooltipContent = {
  align: "center" as const,
  side: "right" as const,
  sideOffset: 8,
}

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

function toggleTheme() {
  isDark.value = !isDark.value
}

const currentLocaleLabel = computed(() => locales.find((l) => l.value === locale.value)?.label ?? locale.value)
function switchLocale() {
  const next = locales[(locales.findIndex((l) => l.value === locale.value) + 1) % locales.length]
  locale.value = next.value
}
</script>

<template>
  <aside class="flex flex-col items-center pb-2 w-16 pt-4 border-r border-[var(--ui-border)] select-none">
    <!-- Лого -->
    <RouterLink to="/" class="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg">
      <LogoSvg class="w-8 h-8" />
    </RouterLink>

    <!-- Проекты (скроллятся) -->
    <div class="flex-1 min-h-0 overflow-y-auto flex flex-col items-center gap-1 mt-4">
      <UTooltip :text="t('common.projectA')" :content="tooltipContent" :delay-duration="0">
        <div
          class="flex-shrink-0 relative flex items-center justify-center w-10 h-10 rounded-lg transition-colors font-semibold text-[var(--ui-text-muted)] hover:bg-[var(--ui-bg-elevated)] hover:text-[var(--ui-text)]"
        >
          A
        </div>
      </UTooltip>

      <UTooltip :text="t('common.projectB')" :content="tooltipContent" :delay-duration="0">
        <div
          class="flex-shrink-0 relative flex items-center justify-center w-10 h-10 rounded-lg transition-colors font-semibold text-[var(--ui-text-muted)] hover:bg-[var(--ui-bg-elevated)] hover:text-[var(--ui-text)]"
        >
          B
        </div>
      </UTooltip>

      <!-- Кнопка создания проекта -->
      <UTooltip :text="t('common.newProject')" :content="tooltipContent" :delay-duration="0">
        <button
          class="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg transition-colors text-[var(--ui-text-muted)] hover:bg-[var(--ui-bg-elevated)] hover:text-[var(--ui-text)]"
        >
          <UIcon name="i-lucide-plus" class="w-5 h-5" />
        </button>
      </UTooltip>
    </div>

    <!-- Системная навигация -->
    <div class="flex-shrink-0 flex flex-col items-center gap-1 mt-2">
      <UTooltip :text="t('common.events')" :content="tooltipContent" :delay-duration="0">
        <button
          class="relative flex items-center justify-center w-10 h-10 rounded-lg transition-colors text-[var(--ui-text-muted)] hover:bg-[var(--ui-bg-elevated)] hover:text-[var(--ui-text)]"
          @click="emit('open-events')"
        >
          <UIcon name="i-lucide-zap" class="w-5 h-5" />
        </button>
      </UTooltip>

      <UTooltip :text="t('common.logs')" :content="tooltipContent" :delay-duration="0">
        <button
          class="relative flex items-center justify-center w-10 h-10 rounded-lg transition-colors text-[var(--ui-text-muted)] hover:bg-[var(--ui-bg-elevated)] hover:text-[var(--ui-text)]"
          @click="emit('open-logs')"
        >
          <UIcon name="i-lucide-scroll-text" class="w-5 h-5" />
        </button>
      </UTooltip>

      <UTooltip :text="themeText" :content="tooltipContent" :delay-duration="0">
        <button
          class="relative flex items-center justify-center w-10 h-10 rounded-lg transition-colors text-[var(--ui-text-muted)] hover:bg-[var(--ui-bg-elevated)] hover:text-[var(--ui-text)]"
          @click="toggleTheme"
        >
          <UIcon :name="themeIcon" class="w-5 h-5" />
        </button>
      </UTooltip>

      <UTooltip :text="currentLocaleLabel" :content="tooltipContent" :delay-duration="0">
        <button
          class="relative flex items-center justify-center w-10 h-10 rounded-lg transition-colors text-[var(--ui-text-muted)] hover:bg-[var(--ui-bg-elevated)] hover:text-[var(--ui-text)] text-xs font-semibold"
          @click="switchLocale"
        >
          {{ locale.toUpperCase() }}
        </button>
      </UTooltip>

      <UTooltip :text="t('common.settings')" :content="tooltipContent" :delay-duration="0">
        <RouterLink
          to="/settings"
          class="relative flex items-center justify-center w-10 h-10 rounded-lg transition-colors text-[var(--ui-text-muted)] hover:bg-[var(--ui-bg-elevated)] hover:text-[var(--ui-text)]"
          active-class="bg-[var(--ui-bg-elevated)] text-[var(--ui-text)]"
        >
          <UIcon name="i-lucide-settings" class="w-5 h-5" />
        </RouterLink>
      </UTooltip>
    </div>
  </aside>
</template>
