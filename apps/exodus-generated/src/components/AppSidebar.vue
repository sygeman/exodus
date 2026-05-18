<script setup lang="ts">
import LogoSvg from "@/assets/logo.svg"
import { useT } from "@exodus/edem-vue"

const t = useT()
</script>

<template>
  <aside
    class="electrobun-webkit-app-region-drag flex w-16 flex-col items-center select-none [&&>*]:select-none"
  >
    <RouterLink
      to="/"
      class="electrobun-webkit-app-region-no-drag flex h-12 w-12 shrink-0 items-center justify-center rounded-lg"
    >
      <LogoSvg class="h-8 w-8" />
    </RouterLink>
    <ProjectsSidebar />
    <div class="my-2 flex shrink-0 flex-col items-center gap-1">
      <UTooltip :text="t({ en: 'Settings', ru: 'Настройки' })" :delay-duration="0">
        <RouterLink
          to="/settings"
          class="electrobun-webkit-app-region-no-drag text-muted hover:bg-default hover:text-default relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors"
        >
          <UIcon name="i-lucide-settings" class="h-5 w-5" />
        </RouterLink>
      </UTooltip>
    </div>
  </aside>
</template>
