<script setup lang="ts">
import { useLogs } from "@/composables/useLogs"
import { useT } from "@exodus/edem-vue"

const { items: logs, loading, update: updateLogs, remove: removeLogs } = useLogs()
const t = useT()

function formatTime(ts: number | string | Date): string {
  const d = new Date(ts)
  return d.toLocaleTimeString()
}

// TODO: implement levelBadgeColor
</script>

<template>
  <div class="bg-default flex h-full flex-col">
    <div class="border-default flex items-center justify-between border-b px-4 py-3">
      <div class="flex items-center gap-3">
        <h1 class="text-xl font-bold">{{ t({ en: "Logs", ru: "Логи" }) }}</h1>
      </div>
      <div class="flex items-center gap-2">
        <UButton color="error" variant="subtle" @click="clear($event)">{{
          t({ en: "Clear", ru: "Очистить" })
        }}</UButton>
      </div>
    </div>
    <div class="border-default flex flex-wrap gap-2 border-b px-4 py-2">
      <USelectMenu
        :model-value="levelFilter"
        :items="levelOptions"
        value-key="value"
        class="w-28"
      />
      <USelectMenu
        :model-value="sourceFilter"
        :items="sourceOptions"
        value-key="value"
        class="w-28"
      />
      <UInput
        :model-value="textFilter"
        :placeholder="t({ en: 'Search logs', ru: 'Поиск логов' })"
        class="min-w-0 flex-1"
      />
    </div>
    <UScrollArea v-for="item in logs" :key="item.id" class="min-h-0 flex-1">
      <div
        class="group border-default hover:bg-elevated border-b px-4 py-2 text-xs leading-relaxed"
      >
        <div class="group flex items-center gap-2">
          <span class="text-muted font-mono">{{ formatTime(item.created_at) }}</span>
          <UBadge
            :color="levelBadgeColor(item.data.level)"
            variant="subtle"
            class="text-[10px] uppercase"
            >{{ item.data.level }}</UBadge
          >
          <span class="min-w-0 flex-1 truncate">{{ item.data.message }}</span>
        </div>
      </div>
    </UScrollArea>
    <div class="border-default flex items-center justify-between border-t px-4 py-2">
      <span class="text-muted text-xs">{{
        t({ en: "{total} logs", ru: "{total} логов" }, { total })
      }}</span>
      <div class="flex items-center gap-1">
        <UButton
          icon="i-lucide-chevrons-left"
          variant="ghost"
          size="xs"
          @click="firstPage($event)"
        />
        <UButton icon="i-lucide-chevron-left" variant="ghost" size="xs" @click="prevPage($event)" />
        <UButton
          icon="i-lucide-chevron-right"
          variant="ghost"
          size="xs"
          @click="nextPage($event)"
        />
        <UButton
          icon="i-lucide-chevrons-right"
          variant="ghost"
          size="xs"
          @click="lastPage($event)"
        />
      </div>
    </div>
  </div>
</template>
