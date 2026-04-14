<script setup lang="ts">
import { ref } from "vue"
import AppSidebar from "@/mainview/components/AppSidebar.vue"
import EventoModal from "@/mainview/components/EventoModal.vue"
import LoggerModal from "@/modules/logger/components/LoggerModal.vue"

const isDebugOpen = ref(false)
const isLogsOpen = ref(false)
</script>

<template>
  <UApp>
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
