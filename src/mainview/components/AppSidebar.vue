<script setup lang="ts">
import { computed } from "vue"
import { useColorMode } from "@vueuse/core"
import LogoSvg from "@/mainview/assets/logo.svg"

const emit = defineEmits<{
  (e: "open-events"): void
  (e: "open-logs"): void
}>()

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
const themeText = computed(() => (isDark.value ? "Light mode" : "Dark mode"))

function toggleTheme() {
  isDark.value = !isDark.value
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
      <UTooltip text="Project A" :content="tooltipContent" :delay-duration="0">
        <div
          class="flex-shrink-0 relative flex items-center justify-center w-10 h-10 rounded-lg transition-colors font-semibold text-[var(--ui-text-muted)] hover:bg-[var(--ui-bg-elevated)] hover:text-[var(--ui-text)]"
        >
          A
        </div>
      </UTooltip>

      <UTooltip text="Project B" :content="tooltipContent" :delay-duration="0">
        <div
          class="flex-shrink-0 relative flex items-center justify-center w-10 h-10 rounded-lg transition-colors font-semibold text-[var(--ui-text-muted)] hover:bg-[var(--ui-bg-elevated)] hover:text-[var(--ui-text)]"
        >
          B
        </div>
      </UTooltip>

      <!-- Кнопка создания проекта -->
      <UTooltip text="New Project" :content="tooltipContent" :delay-duration="0">
        <button
          class="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg transition-colors text-[var(--ui-text-muted)] hover:bg-[var(--ui-bg-elevated)] hover:text-[var(--ui-text)]"
        >
          <UIcon name="i-lucide-plus" class="w-5 h-5" />
        </button>
      </UTooltip>
    </div>

    <!-- Системная навигация -->
    <div class="flex-shrink-0 flex flex-col items-center gap-1 mt-2">
      <UTooltip text="Events" :content="tooltipContent" :delay-duration="0">
        <button
          class="relative flex items-center justify-center w-10 h-10 rounded-lg transition-colors text-[var(--ui-text-muted)] hover:bg-[var(--ui-bg-elevated)] hover:text-[var(--ui-text)]"
          @click="emit('open-events')"
        >
          <UIcon name="i-lucide-zap" class="w-5 h-5" />
        </button>
      </UTooltip>

      <UTooltip text="Logs" :content="tooltipContent" :delay-duration="0">
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

      <UTooltip text="Settings" :content="tooltipContent" :delay-duration="0">
        <button
          class="relative flex items-center justify-center w-10 h-10 rounded-lg transition-colors text-[var(--ui-text-muted)] hover:bg-[var(--ui-bg-elevated)] hover:text-[var(--ui-text)]"
        >
          <UIcon name="i-lucide-settings" class="w-5 h-5" />
        </button>
      </UTooltip>
    </div>
  </aside>
</template>
