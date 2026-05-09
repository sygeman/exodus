<script setup lang="ts">
import { useLogs } from "@/composables/useLogs"
import { useEdem } from "@/edem"

const { items: logs, loading, update: updateLogs, remove: removeLogs } = useLogs()
const edem = useEdem()

function handleTogglePauseLogs() {
  edem.flows.trigger({ flow_id: "togglePauseLogs" })
}

function handleClearLogs() {
  edem.flows.trigger({ flow_id: "clearLogs" })
}

function handleCopyLog(item) {
  edem.flows.trigger({ flow_id: "copyLog", logId: item.id })
}

function handleFirstPage() {
  edem.flows.trigger({ flow_id: "firstPage" })
}

function handlePrevPage() {
  edem.flows.trigger({ flow_id: "prevPage" })
}

function handleNextPage() {
  edem.flows.trigger({ flow_id: "nextPage" })
}

function handleLastPage() {
  edem.flows.trigger({ flow_id: "lastPage" })
}

// TODO: implement formatTime
</script>

<template>
  <div class="flex h-full flex-col bg-[var(--ui-bg)]">
    <div class="flex items-center justify-between border-b border-[var(--ui-border)] px-4 py-3">
      <div class="flex items-center gap-3">
        <h1 class="text-xl font-bold">Logs</h1>
        <UBadge color="warning" variant="subtle">Paused</UBadge>
      </div>
      <div class="flex items-center gap-2">
        <div class="mr-2 hidden items-center gap-3 text-xs text-[var(--ui-text-muted)] sm:flex">
          <span class="text-[var(--ui-text-dimmed)]">Debug</span>
          <span class="font-medium tabular-nums">{{ stats.debug }}</span>
          <span class="text-[var(--ui-text-dimmed)]">Info</span>
          <span class="font-medium tabular-nums">{{ stats.info }}</span>
          <span class="text-[var(--ui-text-dimmed)]">Warn</span>
          <span class="font-medium tabular-nums">{{ stats.warn }}</span>
          <span class="text-[var(--ui-text-dimmed)]">Error</span>
          <span class="font-medium tabular-nums">{{ stats.error }}</span>
        </div>
        <UButton color="warning" variant="subtle" @click="handleTogglePauseLogs()">Resume</UButton>
        <UButton color="error" variant="subtle" @click="handleClearLogs()">Clear</UButton>
      </div>
    </div>
    <div class="flex flex-wrap gap-2 border-b border-[var(--ui-border)] px-4 py-2">
      <USelectMenu :model-value="levelFilter" :items="levelOptions" class="w-28" />
      <USelectMenu :model-value="sourceFilter" :items="sourceOptions" class="w-28" />
      <UInput :model-value="textFilter" placeholder="Search logs..." class="min-w-0 flex-1" />
    </div>
    <UScrollArea class="min-h-0 flex-1" v-for="item in logs" :key="item.id">
      <div
        class="group border-b border-[var(--ui-border)] px-4 py-2 text-xs leading-relaxed hover:bg-[var(--ui-bg-elevated)]"
      >
        <div class="group flex items-center gap-2">
          <span class="font-mono text-[var(--ui-text-muted)]">{{
            formatTime(item.timestamp)
          }}</span>
          <UBadge color="neutral" variant="subtle" class="text-[10px] uppercase">{{
            item.level
          }}</UBadge>
          <span
            class="rounded px-1.5 py-0.5 text-[10px] uppercase"
            :style="
              item.source === 'bun'
                ? 'background-color: rgba(59,130,246,0.1); color: #3b82f6'
                : 'background-color: rgba(16,185,129,0.1); color: #10b981'
            "
            >{{ item.source }}</span
          >
          <span class="min-w-0 flex-1 truncate">{{ item.message }}</span>
          <UBadge color="neutral" variant="subtle" class="text-[10px]">+{{ item.count }}</UBadge>
          <UButton
            icon="i-lucide-copy"
            variant="ghost"
            size="xs"
            class="opacity-0 transition-opacity group-hover:opacity-100"
            @click="handleCopyLog(item)"
          />
        </div>
      </div>
    </UScrollArea>
    <div class="flex items-center justify-between border-t border-[var(--ui-border)] px-4 py-2">
      <span class="text-xs text-[var(--ui-text-muted)]">{{ total }} logs</span>
      <div class="flex items-center gap-1">
        <UButton
          icon="i-lucide-chevrons-left"
          variant="ghost"
          size="xs"
          @click="handleFirstPage()"
        />
        <UButton icon="i-lucide-chevron-left" variant="ghost" size="xs" @click="handlePrevPage()" />
        <UButton
          icon="i-lucide-chevron-right"
          variant="ghost"
          size="xs"
          @click="handleNextPage()"
        />
        <UButton
          icon="i-lucide-chevrons-right"
          variant="ghost"
          size="xs"
          @click="handleLastPage()"
        />
      </div>
    </div>
  </div>
</template>
