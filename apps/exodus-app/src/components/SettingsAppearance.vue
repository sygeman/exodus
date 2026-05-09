<script setup lang="ts">
import { useEdem } from "@/edem"

const edem = useEdem()

function handleToggleDarkMode() {
  edem.flows.trigger({ flow_id: "toggleDarkMode" })
}
</script>

<template>
  <div class="overflow-y-auto p-10">
    <h1 class="mb-6 text-lg font-bold">Settings</h1>
    <section>
      <div class="flex items-center justify-between">
        <div>
          <h3 class="font-medium">Dark Mode</h3>
          <p class="text-muted text-sm">Toggle dark mode appearance</p>
        </div>
        <USwitch @update:model-value="handleToggleDarkMode()" />
      </div>
    </section>
  </div>
</template>
