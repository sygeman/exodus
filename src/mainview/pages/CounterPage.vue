<script setup lang="ts">
import { useI18n } from "vue-i18n"
import { useCounter } from "@/modules/counter/webview"
import { useTimer } from "@/modules/timer/webview"

const { t } = useI18n()
const { count, autoIncrement, loading, increment, reset, setAuto } = useCounter()
const { time } = useTimer()
</script>

<template>
  <div class="p-8 flex flex-col items-center gap-4">
    <h1 class="text-2xl font-bold">
      {{ t("counter.title", { value: loading ? t("counter.loading") : count }) }}
    </h1>
    <div class="flex gap-2">
      <UButton :loading="loading" @click="increment">{{ t("common.increment") }}</UButton>
      <UButton :loading="loading" color="neutral" variant="subtle" @click="reset">{{
        t("common.reset")
      }}</UButton>
    </div>
    <div class="flex items-center gap-2">
      <USwitch v-model="autoIncrement" :disabled="loading" @update:model-value="setAuto" />
      <span class="text-sm text-gray-600">{{ t("common.autoIncrement") }}</span>
    </div>
    <p class="text-sm text-gray-500">
      {{ t("counter.time", { time: new Date(time).toLocaleTimeString() }) }}
    </p>
  </div>
</template>
