<script setup lang="ts">
import { useApp_state } from "@/composables/useApp_state"
import { useEdem } from "@/edem"

const { item: app_state, update: updateApp_state } = useApp_state()
const edem = useEdem()

function handleRefreshState() {
  edem.flows.trigger({ flow_id: "refreshState" })
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex items-center justify-between border-b px-4 py-2">
      <h1 class="font-bold">State</h1>
      <UButton variant="subtle" @click="handleRefreshState()">Refresh</UButton>
    </div>
    <UScrollArea class="min-h-0 flex-1" v-for="item in app_state" :key="item.id">
      <pre class="p-4 font-mono text-xs">{{ JSON.stringify(item.data, null, 2) }}</pre>
    </UScrollArea>
  </div>
</template>
