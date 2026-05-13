<script setup lang="ts">
import { computed } from "vue"
import { useT } from "@exodus/edem-vue"
import MenuLayout, { type MenuLayoutItem } from "@/components/MenuLayout.vue"

const t = useT()

const navItems = computed<MenuLayoutItem[]>(() => [
  { to: "/debug/logs", label: t({ en: "Logs", ru: "Логи" }), icon: "i-lucide-scroll-text" },
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
