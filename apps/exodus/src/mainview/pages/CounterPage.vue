<script setup lang="ts">
import { useCounter } from "../../modules/counter/webview"
import { useTimer } from "../../modules/timer/webview"

const { count, increment, reset } = useCounter()
const { time } = useTimer()
</script>

<template>
  <div class="p-8 flex flex-col items-center gap-4">
    <h1 class="text-2xl font-bold">Counter: {{ count }}</h1>
    <div class="flex gap-2">
      <UButton @click="increment">Increment</UButton>
      <UButton color="neutral" variant="subtle" @click="reset">Reset</UButton>
    </div>
    <p class="text-sm text-gray-500">Time: {{ new Date(time).toLocaleTimeString() }}</p>
  </div>
</template>
