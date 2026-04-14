<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "vue-i18n"
import * as nuxtLocales from "@nuxt/ui/locale"
import AppSidebar from "@/mainview/components/AppSidebar.vue"
import EventoModal from "@/mainview/components/EventoModal.vue"
import LoggerModal from "@/modules/logger/components/LoggerModal.vue"
import { useModalRoute } from "@/mainview/composables/useModalRoute"

const { isEventsOpen, isLogsOpen } = useModalRoute()

const { locale } = useI18n()
const appLocale = computed(
  () => (nuxtLocales as Record<string, (typeof nuxtLocales)["en"]>)[locale.value] ?? nuxtLocales.en,
)
</script>

<template>
  <UApp :locale="appLocale">
    <div class="flex h-screen">
      <AppSidebar />

      <!-- Основной контент -->
      <main class="flex-1 overflow-auto">
        <RouterView />
      </main>
    </div>

    <EventoModal v-if="isEventsOpen" />
    <LoggerModal v-if="isLogsOpen" />
  </UApp>
</template>
