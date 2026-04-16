<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "vue-i18n"
import MenuLayout, { type MenuLayoutItem } from "@/core/components/MenuLayout.vue"

const { t } = useI18n()

const navItems = computed<MenuLayoutItem[]>(() => [
  { to: "/debug/logs", label: t("common.logs"), icon: "i-lucide-scroll-text" },
  { to: "/debug/events", label: t("common.events"), icon: "i-lucide-zap" },
  { to: "/debug/playground", label: t("common.playground"), icon: "i-lucide-flask-conical" },
  { to: "/debug/state", label: t("common.state"), icon: "i-lucide-database" },
])
</script>

<template>
  <MenuLayout :title="t('common.debug')" :items="navItems" main-class="overflow-hidden">
    <RouterView />
  </MenuLayout>
</template>
