<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "vue-i18n"
import MenuLayout, { type MenuLayoutItem } from "@/components/MenuLayout.vue"

const { t } = useI18n({
  messages: {
    en: { Debug: "Debug", Logs: "Logs", State: "State" },
    ru: { Debug: "Отладка", Logs: "Логи", State: "Состояние" },
  },
})

const navItems = computed<MenuLayoutItem[]>(() => [
  { to: "/debug/logs", label: t("Logs"), icon: "i-lucide-scroll-text" },
  { to: "/debug/state", label: t("State"), icon: "i-lucide-database" },
])
</script>

<template>
  <MenuLayout :title="t('Debug')" :items="navItems" main-class="overflow-hidden">
    <RouterView />
  </MenuLayout>
</template>
