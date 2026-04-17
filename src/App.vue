<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "vue-i18n"
import * as nuxtLocales from "@nuxt/ui/locale"
import AppSidebar from "@/components/AppSidebar.vue"
import UpdaterToast from "@/modules/updater/components/UpdaterToast.vue"

const { locale } = useI18n()
const appLocale = computed(
  () => (nuxtLocales as Record<string, (typeof nuxtLocales)["en"]>)[locale.value] ?? nuxtLocales.en,
)
</script>

<template>
  <UApp :locale="appLocale">
    <div
      class="electrobun-webkit-app-region-drag flex h-screen bg-[var(--ui-bg-elevated)] pt-8 pr-2 pb-2"
    >
      <AppSidebar class="electrobun-webkit-app-region-no-drag" />

      <!-- Основной контент -->
      <main
        class="electrobun-webkit-app-region-no-drag flex-1 overflow-hidden rounded-xl border border-[var(--ui-border)] bg-[var(--ui-bg)]"
      >
        <RouterView />
      </main>
    </div>
    <UpdaterToast />
  </UApp>
</template>
