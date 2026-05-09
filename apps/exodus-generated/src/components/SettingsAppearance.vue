<script setup lang="ts">
import { useEdem } from "@/edem"

const edem = useEdem()

function handleToggleDarkMode() {
  edem.flows.trigger({ flow_id: "toggleDarkMode" })
}
</script>

<template>
  <section class="flex flex-col gap-8">
    <div class="flex items-start justify-between gap-4">
      <div class="flex flex-col gap-1">
        <h3 class="text-base font-medium">Dark Mode</h3>
        <p class="text-sm text-[var(--ui-text-muted)]">Toggle dark mode appearance</p>
      </div>
      <USwitch :model-value="isDark" @update:model-value="handleToggleDarkMode()" />
    </div>
  </section>
</template>
