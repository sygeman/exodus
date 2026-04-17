<script setup lang="ts">
import { useI18n } from "vue-i18n"
import LogoSvg from "@/assets/logo.svg"
import ProjectsSidebar from "@/modules/projects/components/ProjectsSidebar.vue"

const { t } = useI18n()

const tooltipContent = {
  align: "center" as const,
  side: "right" as const,
  sideOffset: 8,
}
</script>

<template>
  <aside
    class="electrobun-webkit-app-region-drag flex w-16 flex-col items-center select-none [&&>*]:select-none"
  >
    <!-- Лого -->
    <RouterLink
      to="/"
      class="electrobun-webkit-app-region-no-drag my-2 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
    >
      <LogoSvg class="h-8 w-8" />
    </RouterLink>

    <!-- Проекты (скроллятся) -->
    <ProjectsSidebar />

    <!-- Системная навигация -->
    <div class="mt-2 flex flex-shrink-0 flex-col items-center gap-1">
      <UTooltip :text="t('common.settings')" :content="tooltipContent" :delay-duration="0">
        <RouterLink
          to="/settings"
          class="electrobun-webkit-app-region-no-drag relative flex h-10 w-10 items-center justify-center rounded-lg text-[var(--ui-text-muted)] transition-colors hover:bg-[var(--ui-bg)] hover:text-[var(--ui-text)]"
          active-class="bg-[var(--ui-bg)] text-[var(--ui-text)]"
        >
          <UIcon name="i-lucide-settings" class="h-5 w-5" />
        </RouterLink>
      </UTooltip>
    </div>
  </aside>
</template>
