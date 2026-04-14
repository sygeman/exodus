<script setup lang="ts">
import { ref, computed } from "vue"
import { useI18n } from "vue-i18n"
import * as nuxtLocales from "@nuxt/ui/locale"
import AppSidebar from "@/mainview/components/AppSidebar.vue"
import EventoModal from "@/mainview/components/EventoModal.vue"
import LoggerModal from "@/modules/logger/components/LoggerModal.vue"

const isDebugOpen = ref(false)
const isLogsOpen = ref(false)

const { locale } = useI18n()
const appLocale = computed(() => (nuxtLocales as Record<string, (typeof nuxtLocales)['en']>)[locale.value] ?? nuxtLocales.en)
</script>

<template>
  <UApp :locale="appLocale">
    <div class="flex h-screen">
      <AppSidebar @open-events="isDebugOpen = true" @open-logs="isLogsOpen = true" />

      <!-- Основной контент -->
      <main class="flex-1 overflow-auto">
        <RouterView />
      </main>
    </div>

    <EventoModal v-if="isDebugOpen" @close="isDebugOpen = false" />
    <LoggerModal v-if="isLogsOpen" @close="isLogsOpen = false" />
  </UApp>
</template>
