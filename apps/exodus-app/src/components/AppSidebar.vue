<script setup lang="ts">
const items_AppSidebar_do2bb5 = [
  { label: "Projects", icon: "i-lucide-folder", to: "/projects" },
  { label: "Debug Logs", icon: "i-lucide-terminal", to: "/debug/logs" },
  { label: "Debug State", icon: "i-lucide-database", to: "/debug/state" },
  { label: "Appearance", icon: "i-lucide-palette", to: "/settings/appearance" },
  { label: "Language", icon: "i-lucide-globe", to: "/settings/language" },
] as const
</script>

<template>
  <aside class="flex w-56 flex-col border-r border-[var(--ui-border)] bg-[var(--ui-bg)]">
    <div class="flex items-center gap-2 px-4 pb-4">
      <UIcon name="i-lucide-box" class="text-primary text-lg" />
      <span class="font-bold">Exodus</span>
    </div>
    <UNavigationMenu
      orientation="vertical"
      v-for="(item, idx) in items_AppSidebar_do2bb5"
      :key="idx"
    >
      <div class="flex items-center gap-2">
        <UIcon :name="item.icon" />
        <span>{{ item.label }}</span>
      </div>
    </UNavigationMenu>
  </aside>
</template>
