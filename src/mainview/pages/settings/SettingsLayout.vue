<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "vue-i18n"
import { useRoute } from "vue-router"

const { t } = useI18n()
const route = useRoute()

const navItems = computed(() => [
  { to: "/settings/appearance", label: t("common.appearance"), icon: "i-lucide-palette" },
  { to: "/settings/language", label: t("common.language"), icon: "i-lucide-globe" },
  { to: "/settings/about", label: t("common.about"), icon: "i-lucide-info" },
])

const activeItem = computed(() => navItems.value.find((item) => route.path === item.to))
</script>

<template>
  <div class="flex h-full">
    <!-- Левая панель -->
    <aside
      class="flex w-56 flex-col gap-6 border-r border-[var(--ui-border)] bg-[var(--ui-bg-elevated)]/50 p-4"
    >
      <div>
        <h2 class="px-2 text-xl font-bold">{{ t("common.settings") }}</h2>
      </div>

      <nav class="flex flex-col gap-0.5">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm font-medium text-[var(--ui-text-muted)] transition-colors hover:bg-[var(--ui-bg-elevated)] hover:text-[var(--ui-text)]"
          :class="{
            'bg-[var(--ui-primary)]/10 text-[var(--ui-primary)] hover:bg-[var(--ui-primary)]/10 hover:text-[var(--ui-primary)]':
              route.path === item.to,
          }"
        >
          <UIcon :name="item.icon" class="h-4 w-4" />
          {{ item.label }}
        </RouterLink>
      </nav>
    </aside>

    <!-- Правая панель -->
    <main class="flex-1 overflow-y-auto p-10">
      <div class="mx-auto max-w-2xl">
        <h1 class="mb-8 text-2xl font-bold">{{ activeItem?.label }}</h1>
        <RouterView />
      </div>
    </main>
  </div>
</template>
