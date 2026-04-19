<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "vue-i18n"
import { useRoute } from "vue-router"
import SettingsLayout from "@/components/SettingsLayout.vue"
import type { MenuLayoutItem } from "@/components/MenuLayout.vue"

const { t } = useI18n()
const route = useRoute()

const navItems = computed<MenuLayoutItem[]>(() => [
  { to: "/settings/appearance", label: t("common.appearance"), icon: "i-lucide-palette" },
  { to: "/settings/language", label: t("common.language"), icon: "i-lucide-globe" },
])

const activeItem = computed(() => navItems.value.find((item) => route.path === item.to))
</script>

<template>
  <SettingsLayout
    :title="t('common.settings')"
    :items="navItems"
    :page-title="activeItem?.label ?? ''"
  >
    <RouterView />
  </SettingsLayout>
</template>
