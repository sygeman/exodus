<script setup lang="ts">
import { computed } from "vue"
import { useRoute, useRouter } from "vue-router"
import { useCounter } from "../../modules/counter/webview"
import { useTimer } from "../../modules/timer/webview"
import EventoModal from "../components/EventoModal.vue"

const router = useRouter()
const route = useRoute()
const { count, autoIncrement, loading, increment, reset, setAuto } = useCounter()
const { time } = useTimer()

const isDebugOpen = computed(() => route.query.debug === "evento")

function openDebug() {
  router.push({ query: { debug: "evento" } })
}

function closeDebug() {
  router.push({ query: {} })
}
</script>

<template>
  <div class="p-8 flex flex-col items-center gap-4">
    <h1 class="text-2xl font-bold">Counter: {{ loading ? '...' : count }}</h1>
    <div class="flex gap-2">
      <UButton :loading="loading" @click="increment">Increment</UButton>
      <UButton :loading="loading" color="neutral" variant="subtle" @click="reset">Reset</UButton>
    </div>
    <div class="flex items-center gap-2">
      <USwitch v-model="autoIncrement" :disabled="loading" @update:model-value="setAuto" />
      <span class="text-sm text-gray-600">Auto increment</span>
    </div>
    <p class="text-sm text-gray-500">Time: {{ new Date(time).toLocaleTimeString() }}</p>
    <UButton variant="ghost" color="neutral" @click="openDebug">
      Open Evento Debug →
    </UButton>
  </div>

  <EventoModal v-if="isDebugOpen" @close="closeDebug" />
</template>
