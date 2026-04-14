<script setup lang="ts">
import LogoSvg from "@/mainview/assets/logo.svg"

const emit = defineEmits<{
  (e: "open-events"): void
}>()

const tooltipContent = {
  align: "center" as const,
  side: "bottom" as const,
  sideOffset: 8,
}
</script>

<template>
  <aside class="flex flex-col items-center pb-2 w-16 pt-4 border-r border-[var(--ui-border)]">
    <!-- Лого -->
    <RouterLink to="/" class="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg">
      <LogoSvg class="w-8 h-8" />
    </RouterLink>

    <!-- Проекты (скроллятся) -->
    <div class="flex-1 min-h-0 overflow-y-auto flex flex-col items-center gap-1 mt-4">
      <UTooltip text="Project A" :content="tooltipContent">
        <div
          class="flex-shrink-0 relative flex items-center justify-center w-10 h-10 rounded-lg transition-colors font-semibold text-[var(--ui-text-muted)] hover:bg-[var(--ui-bg-elevated)] hover:text-[var(--ui-text)]"
        >
          A
        </div>
      </UTooltip>

      <UTooltip text="Project B" :content="tooltipContent">
        <div
          class="flex-shrink-0 relative flex items-center justify-center w-10 h-10 rounded-lg transition-colors font-semibold text-[var(--ui-text-muted)] hover:bg-[var(--ui-bg-elevated)] hover:text-[var(--ui-text)]"
        >
          B
        </div>
      </UTooltip>

      <!-- Кнопка создания проекта -->
      <UTooltip text="New Project" :content="tooltipContent">
        <button
          class="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg transition-colors text-[var(--ui-text-muted)] hover:bg-[var(--ui-bg-elevated)] hover:text-[var(--ui-text)]"
        >
          <UIcon name="i-lucide-plus" class="w-5 h-5" />
        </button>
      </UTooltip>
    </div>

    <!-- Системная навигация -->
    <div class="flex-shrink-0 flex flex-col items-center gap-1 mt-2">
      <UTooltip text="Events" :content="tooltipContent">
        <button
          class="relative flex items-center justify-center w-10 h-10 rounded-lg transition-colors text-[var(--ui-text-muted)] hover:bg-[var(--ui-bg-elevated)] hover:text-[var(--ui-text)]"
          @click="emit('open-events')"
        >
          <UIcon name="i-lucide-zap" class="w-5 h-5" />
        </button>
      </UTooltip>

      <UTooltip text="Settings" :content="tooltipContent">
        <button
          class="relative flex items-center justify-center w-10 h-10 rounded-lg transition-colors text-[var(--ui-text-muted)] hover:bg-[var(--ui-bg-elevated)] hover:text-[var(--ui-text)]"
        >
          <UIcon name="i-lucide-settings" class="w-5 h-5" />
        </button>
      </UTooltip>
    </div>
  </aside>
</template>
