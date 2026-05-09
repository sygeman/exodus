<script setup lang="ts">
import { useEdem } from "@/edem"

const edem = useEdem()

function handleRefreshState() {
  edem.flows.trigger({ flow_id: "refreshState" })
}

// TODO: implement formatJson
</script>

<template>
  <div class="flex h-full flex-col bg-[var(--ui-bg)]">
    <div class="flex items-center justify-between border-b border-[var(--ui-border)] px-4 py-3">
      <h1 class="text-xl font-bold">State</h1>
      <UButton variant="subtle" :loading="loading" @click="handleRefreshState()">Refresh</UButton>
    </div>
    <UScrollArea class="min-h-0 flex-1">
      <pre class="p-4 font-mono text-xs leading-relaxed text-[var(--ui-text)]">{{ formatJson(appState) }}</pre>
    </UScrollArea>
  </div>
</template>
