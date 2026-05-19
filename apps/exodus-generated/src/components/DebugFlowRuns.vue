<script setup lang="ts">
import { useRouter } from "vue-router"
import { useT } from "@exodus/edem-vue"

const router = useRouter()
const t = useT()
const props = defineProps<Record<string, unknown>>()

function handleNavigatedebug_flows() {
  router.push("/debug/flows")
}

// TODO: implement formatDuration
</script>

<template>
  <div class="bg-default flex h-full flex-col">
    <div class="border-default flex items-center gap-3 border-b px-4 py-3">
      <UButton
        icon="i-lucide-arrow-left"
        variant="ghost"
        size="xs"
        @click="handleNavigatedebug_flows()"
      />
      <div class="flex flex-1 flex-col">
        <h1 class="text-xl font-bold">{{ flow?.name ?? flowId }}</h1>
      </div>
      <UButton
        color="error"
        variant="subtle"
        size="xs"
        icon="i-lucide-trash-2"
        @click="confirmDeleteRuns($event)"
        >{{ t({ en: "Clear history", ru: "Очистить историю" }) }}</UButton
      >
    </div>
    <div class="border-default flex items-center gap-2 border-b px-4 py-2">
      <USelectMenu
        :model-value="statusFilter"
        :items="statusOptions"
        value-key="value"
        class="w-36"
      />
      <span class="text-muted text-xs"
        >{{ filteredRuns.length }}
        {{
          filteredRuns.length === 1
            ? t({ en: "run", ru: "запуск" })
            : t({ en: "runs", ru: "запусков" })
        }}</span
      >
    </div>
    <UScrollArea class="min-h-0 flex-1">
      <div v-for="(item, idx) in filteredRuns" :key="idx" class="flex flex-col gap-1 p-4">
        <button
          class="border-default hover:bg-elevated flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors"
        >
          <span
            class="inline-flex h-5 min-w-12 items-center justify-center rounded px-1.5 text-[10px] font-medium uppercase"
            >{{ runStatusLabel[item.status] ?? item.status }}</span
          >
          <span class="text-muted min-w-0 flex-1 truncate font-mono text-xs">{{
            item.id.slice(0, 8)
          }}</span>
          <span class="text-muted text-xs">{{
            formatDuration(item.started_at, item.completed_at)
          }}</span>
        </button>
      </div>
    </UScrollArea>
  </div>
</template>
