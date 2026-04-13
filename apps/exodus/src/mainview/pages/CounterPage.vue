<script setup lang="ts">
import { useRouter } from "vue-router"
import { useCounter } from "../../modules/counter/webview"
import { useTimer } from "../../modules/timer/webview"

const router = useRouter()
const { count, autoIncrement, increment, reset, setAuto } = useCounter()
const { time } = useTimer()
</script>

<template>
  <div class="p-8 flex flex-col items-center gap-4">
    <h1 class="text-2xl font-bold">Counter: {{ count }}</h1>
    <div class="flex gap-2">
      <UButton @click="increment">Increment</UButton>
      <UButton color="neutral" variant="subtle" @click="reset">Reset</UButton>
    </div>
    <div class="flex items-center gap-2">
      <USwitch v-model="autoIncrement" @update:model-value="setAuto" />
      <span class="text-sm text-gray-600">Auto increment</span>
    </div>
    <p class="text-sm text-gray-500">Time: {{ new Date(time).toLocaleTimeString() }}</p>
    <UButton variant="ghost" color="neutral" @click="router.push('/evento')">
      Open Evento Debug →
    </UButton>
  </div>
</template>
