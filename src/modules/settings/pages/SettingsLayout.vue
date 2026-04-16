<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "vue-i18n"
import { useRoute } from "vue-router"
import MenuLayout, { type MenuLayoutItem } from "@/core/components/MenuLayout.vue"

const { t } = useI18n()
const route = useRoute()

const navItems = computed<MenuLayoutItem[]>(() => [
  { to: "/settings/appearance", label: t("common.appearance"), icon: "i-lucide-palette" },
  { to: "/settings/language", label: t("common.language"), icon: "i-lucide-globe" },
  { to: "/settings/about", label: t("common.about"), icon: "i-lucide-info" },
])

const activeItem = computed(() => navItems.value.find((item) => route.path === item.to))
</script>

<template>
  <MenuLayout :title="t('common.settings')" :items="navItems" main-class="overflow-y-auto p-10">
    <div class="mx-auto max-w-2xl">
      <h1 v-if="activeItem" class="mb-8 text-2xl font-bold">{{ activeItem.label }}</h1>
      <RouterView />
    </div>
  </MenuLayout>
</template>
