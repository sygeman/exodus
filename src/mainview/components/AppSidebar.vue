<script setup lang="ts">
import { useI18n } from "vue-i18n"
import LogoSvg from "@/mainview/assets/logo.svg"
import ProjectsSidebar from "@/modules/projects/components/ProjectsSidebar.vue"

defineProps<{
  updateAvailable?: boolean
}>()

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
    <ProjectsSidebar />

    <!-- Системная навигация -->
    <div class="mt-2 flex flex-shrink-0 flex-col items-center gap-1">
      <UTooltip :text="t('common.debug')" :content="tooltipContent" :delay-duration="0">
        <RouterLink
          to="/debug"
          class="relative flex h-10 w-10 items-center justify-center rounded-lg text-[var(--ui-text-muted)] transition-colors hover:bg-[var(--ui-bg-elevated)] hover:text-[var(--ui-text)]"
          active-class="bg-[var(--ui-bg-elevated)] text-[var(--ui-text)]"
        >
          <UIcon name="i-lucide-bug" class="h-5 w-5" />
        </RouterLink>
      </UTooltip>

      <UTooltip :text="t('common.settings')" :content="tooltipContent" :delay-duration="0">
        <RouterLink
          to="/settings"
          class="relative flex h-10 w-10 items-center justify-center rounded-lg text-[var(--ui-text-muted)] transition-colors hover:bg-[var(--ui-bg-elevated)] hover:text-[var(--ui-text)]"
          active-class="bg-[var(--ui-bg-elevated)] text-[var(--ui-text)]"
        >
          <UIcon name="i-lucide-settings" class="h-5 w-5" />
          <span
            v-if="updateAvailable"
            class="absolute top-2 right-2 h-2 w-2 rounded-full bg-[var(--ui-primary)]"
          />
        </RouterLink>
      </UTooltip>
    </div>
  </aside>
</template>
