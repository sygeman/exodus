<script setup lang="ts">
import { useLogs } from "@/composables/useLogs"
import { useEdem } from "@/edem"

const { items: logs, update: updateLogs, remove: removeLogs } = useLogs()
const edem = useEdem()

function handleTogglePauseLogs() {
  edem.flows.trigger({ flow_id: "togglePauseLogs" })
}

function handleClearLogs() {
  edem.flows.trigger({ flow_id: "clearLogs" })
}

function handleSetLogFilter($event) {
  edem.flows.trigger({ flow_id: "setLogFilter", text: $event })
}

function handleCopyLog(item) {
  edem.flows.trigger({ flow_id: "copyLog", logId: item.id })
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex items-center justify-between border-b px-4 py-2">
      <h1 class="font-bold">Logs</h1>
      <div class="flex items-center gap-2">
        <UButton variant="subtle" @click="handleTogglePauseLogs()">Pause</UButton>
        <UButton variant="subtle" color="error" @click="handleClearLogs()">Clear</UButton>
      </div>
    </div>
    <div class="flex items-center gap-2 border-b px-4 py-2">
      <USelectMenu
        placeholder="Filter by level..."
        class="w-28"
        @update:model-value="handleSetLogFilter($event)"
      />
      <USelectMenu
        placeholder="Filter by source..."
        class="w-28"
        @update:model-value="handleSetLogFilter($event)"
      />
      <UInput
        placeholder="Search logs..."
        class="min-w-0 flex-1"
        @update:model-value="handleSetLogFilter($event)"
      />
    </div>
    <UScrollArea class="min-h-0 flex-1" v-for="item in logs" :key="item.id">
      <div
        class="group hover:bg-elevated flex items-center gap-3 border-b px-4 py-2 transition-colors"
      >
        <span class="text-muted w-20 font-mono text-xs">{{ item.created_at }}</span>
        <UBadge :color="item.level" variant="subtle" class="text-[10px] uppercase">{{
          item.level
        }}</UBadge>
        <span class="text-muted w-24 truncate text-xs">{{ item.source }}</span>
        <span class="flex-1 truncate text-sm">{{ item.message }}</span>
        <UButton
          variant="ghost"
          size="xs"
          icon="i-lucide-copy"
          class="opacity-0 group-hover:opacity-100"
          @click="handleCopyLog(item)"
        />
      </div>
    </UScrollArea>
  </div>
</template>
