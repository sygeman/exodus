<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "vue-i18n"
import * as nuxtLocales from "@nuxt/ui/locale"
import AppSidebar from "@/components/AppSidebar.vue"
import AppTopMenu from "@/components/AppTopMenu.vue"
const { locale } = useI18n()
const appLocale = computed(
  () => (nuxtLocales as Record<string, (typeof nuxtLocales)["en"]>)[locale.value] ?? nuxtLocales.en,
)
</script>

<template>
  <UApp :locale="appLocale">
    <div
      class="electrobun-webkit-app-region-drag flex h-screen bg-[var(--ui-bg-elevated)] pr-2 pb-2"
    >
      <AppSidebar class="pt-8" />

      <!-- Обёртка для top menu + main -->
      <div class="flex flex-1 flex-col overflow-hidden">
        <AppTopMenu class="electrobun-webkit-app-region-drag" />

        <!-- Основной контент -->
        <main
          class="flex-1 overflow-hidden rounded-xl border border-[var(--ui-border)] bg-[var(--ui-bg)]"
        >
          <RouterView />
        </main>
      </div>
    </div>
  </UApp>
</template>
