<script setup lang="ts">
import { useEdem } from "@/edem"

const edem = useEdem()

function handleSetLocale(item) {
  edem.flows.trigger({ flow_id: "setLocale", locale: item.value })
}
</script>

<template>
  <section class="flex flex-col gap-8">
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-1">
        <h3 class="text-base font-medium">Language</h3>
        <p class="text-sm text-[var(--ui-text-muted)]">Select your preferred language</p>
      </div>
      <div class="flex flex-col gap-3" v-for="(item, idx) in locales" :key="idx">
        <button class="flex items-center gap-3 rounded-md border p-3 text-left text-sm transition-all" @click="handleSetLocale(item)">
          <span class="text-2xl">{{ item.flag }}</span>
          <span class="font-medium">{{ item.label }}</span>
        </button>
      </div>
    </div>
  </section>
</template>
