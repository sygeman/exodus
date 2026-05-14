<script setup lang="ts">
import { computed } from "vue"
import { useT } from "@exodus/edem-vue"
import MenuLayout, { type MenuLayoutItem } from "@/components/MenuLayout.vue"

const t = useT()

const navItems = computed<MenuLayoutItem[]>(() => [
  { to: "/debug/logs", label: t({ en: "Logs", ru: "Логи" }), icon: "i-lucide-scroll-text" },
  { to: "/debug/flows", label: t({ en: "Flows", ru: "Флоу" }), icon: "i-lucide-workflow" },
])
</script>

<template>
  <MenuLayout
    :title="t({ en: 'Debug', ru: 'Отладка' })"
    :items="navItems"
    main-class="overflow-hidden"
  >
    <RouterView />
  </MenuLayout>
</template>
