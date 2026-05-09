<script setup lang="ts">
import LogoSvg from "@/assets/logo.svg"
</script>

<template>
  <aside
    class="electrobun-webkit-app-region-drag flex w-16 flex-col items-center select-none [&&>*]:select-none"
  >
    <RouterLink
      to="/"
      class="electrobun-webkit-app-region-no-drag flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg"
    >
      <LogoSvg class="h-8 w-8" />
    </RouterLink>
    <ProjectsSidebar />
    <div class="my-2 flex flex-shrink-0 flex-col items-center gap-1">
      <UTooltip text="Settings" :delay-duration="0">
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
