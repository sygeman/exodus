<script setup lang="ts">
import { computed } from "vue"
import { useT } from "@exodus/edem-vue"
import { useRoute } from "vue-router"
import SettingsLayout from "@/components/SettingsLayout.vue"
import type { MenuLayoutItem } from "@/components/MenuLayout.vue"

const t = useT()
const route = useRoute()

const navItems = computed<MenuLayoutItem[]>(() => [
  {
    to: "/settings/appearance",
    label: t({ en: "Appearance", ru: "Внешний вид" }),
    icon: "i-lucide-palette",
  },
  { to: "/settings/language", label: t({ en: "Language", ru: "Язык" }), icon: "i-lucide-globe" },
  {
    to: "/settings/models",
    label: t({ en: "Models", ru: "Модели" }),
    icon: "i-lucide-cpu",
  },
  {
    to: "/settings/agent",
    label: t({ en: "AI Agent", ru: "AI Агент" }),
    icon: "i-lucide-sparkles",
  },
])

const activeItem = computed(() => navItems.value.find((item) => route.path === item.to))
</script>

<template>
  <SettingsLayout
    :title="t({ en: 'Settings', ru: 'Настройки' })"
    :items="navItems"
    :page-title="activeItem?.label ?? ''"
  >
    <RouterView />
  </SettingsLayout>
</template>
