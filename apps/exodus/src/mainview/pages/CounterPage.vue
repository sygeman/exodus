<script setup lang="ts">
import { useCounter } from "../../modules/counter/webview";

const { count, increment, reset } = useCounter();
</script>

<template>
  <div class="p-8 flex flex-col items-center gap-4">
    <h1 class="text-2xl font-bold">Counter: {{ count }}</h1>
    <div class="flex gap-2">
      <UButton @click="increment">Increment</UButton>
      <UButton color="neutral" variant="subtle" @click="reset">Reset</UButton>
    </div>
  </div>
</template>
