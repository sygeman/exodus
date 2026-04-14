<script setup lang="ts">
import { useI18n } from "vue-i18n"
import LogoSvg from "@/mainview/assets/logo.svg"
import { useModalRoute } from "@/mainview/composables/useModalRoute"

const { openModal } = useModalRoute()
const { t } = useI18n()

const tooltipContent = {
  align: "center" as const,
  side: "right" as const,
  sideOffset: 8,
}
</script>

<template>
  <aside
    class="flex w-16 flex-col items-center border-r border-[var(--ui-border)] pt-4 pb-2 select-none"
  >
    <!-- Лого -->
    <RouterLink to="/" class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg">
      <LogoSvg class="h-8 w-8" />
    </RouterLink>

    <!-- Проекты (скроллятся) -->
    <div class="mt-4 flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto">
      <UTooltip :text="t('common.projectA')" :content="tooltipContent" :delay-duration="0">
        <div
          class="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg font-semibold text-[var(--ui-text-muted)] transition-colors hover:bg-[var(--ui-bg-elevated)] hover:text-[var(--ui-text)]"
        >
          A
        </div>
      </UTooltip>

      <UTooltip :text="t('common.projectB')" :content="tooltipContent" :delay-duration="0">
        <div
          class="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg font-semibold text-[var(--ui-text-muted)] transition-colors hover:bg-[var(--ui-bg-elevated)] hover:text-[var(--ui-text)]"
        >
          B
        </div>
      </UTooltip>

      <!-- Кнопка создания проекта -->
      <UTooltip :text="t('common.newProject')" :content="tooltipContent" :delay-duration="0">
        <button
          class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-[var(--ui-text-muted)] transition-colors hover:bg-[var(--ui-bg-elevated)] hover:text-[var(--ui-text)]"
        >
          <UIcon name="i-lucide-plus" class="h-5 w-5" />
        </button>
      </UTooltip>
    </div>

    <!-- Системная навигация -->
    <div class="mt-2 flex flex-shrink-0 flex-col items-center gap-1">
      <UTooltip :text="t('common.events')" :content="tooltipContent" :delay-duration="0">
        <button
          class="relative flex h-10 w-10 items-center justify-center rounded-lg text-[var(--ui-text-muted)] transition-colors hover:bg-[var(--ui-bg-elevated)] hover:text-[var(--ui-text)]"
          @click="openModal('events')"
        >
          <UIcon name="i-lucide-zap" class="h-5 w-5" />
        </button>
      </UTooltip>

      <UTooltip :text="t('common.logs')" :content="tooltipContent" :delay-duration="0">
        <button
          class="relative flex h-10 w-10 items-center justify-center rounded-lg text-[var(--ui-text-muted)] transition-colors hover:bg-[var(--ui-bg-elevated)] hover:text-[var(--ui-text)]"
          @click="openModal('logs')"
        >
          <UIcon name="i-lucide-scroll-text" class="h-5 w-5" />
        </button>
      </UTooltip>

      <UTooltip :text="t('common.settings')" :content="tooltipContent" :delay-duration="0">
        <RouterLink
          to="/settings"
          class="relative flex h-10 w-10 items-center justify-center rounded-lg text-[var(--ui-text-muted)] transition-colors hover:bg-[var(--ui-bg-elevated)] hover:text-[var(--ui-text)]"
          active-class="bg-[var(--ui-bg-elevated)] text-[var(--ui-text)]"
        >
          <UIcon name="i-lucide-settings" class="h-5 w-5" />
        </RouterLink>
      </UTooltip>
    </div>
  </aside>
</template>
