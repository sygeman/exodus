<script setup lang="ts">
import { useFlows } from "@/composables/useFlows"
import { useT } from "@exodus/edem-vue"

const { items: flows, loading, update: updateFlows, remove: removeFlows } = useFlows()
const t = useT()
</script>

<template>
  <div class="bg-default flex h-full flex-col">
    <div class="border-default flex items-center border-b px-4 py-3">
      <h1 class="text-xl font-bold">{{ t({ en: "Flows", ru: "Флоу" }) }}</h1>
    </div>
    <UScrollArea class="min-h-0 flex-1">
      <div v-for="item in flows" :key="item.id" class="flex flex-col gap-2 p-4">
        <button
          class="border-default hover:bg-elevated flex items-center gap-4 rounded-lg border p-4 text-left transition-colors"
        >
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-500/10"
          >
            <UIcon name="i-lucide-zap" class="h-5 w-5 text-green-500" />
          </div>
          <div class="flex flex-1 flex-col">
            <span class="font-medium">{{ item.name }}</span>
          </div>
        </button>
      </div>
    </UScrollArea>
  </div>
</template>
