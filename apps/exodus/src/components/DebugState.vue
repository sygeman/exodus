<script setup lang="ts">
import { ref, onMounted } from "vue"
import { useT } from "@exodus/edem-vue"
import { edem } from "@/edem"

const t = useT()

const appState = ref<Record<string, unknown> | null>(null)
const loading = ref(false)

async function fetchAppState() {
  loading.value = true
  try {
    const { item } = await edem.data.getSingleton({ collection_id: "app_state" })
    if (item) {
      appState.value = { ...item.data }
    }
  } catch {
    // ignore
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchAppState()
})

function formatJson(data: unknown) {
  try {
    return JSON.stringify(data, null, 2)
  } catch {
    return String(data)
  }
}
</script>

<template>
  <div class="bg-default flex h-full flex-col">
    <!-- Header -->
    <div class="border-default flex items-center justify-between border-b px-4 py-3">
      <div class="flex items-center gap-3">
        <h1 class="text-xl font-bold">{{ t({ en: "State", ru: "Состояние" }) }}</h1>
      </div>
      <div class="flex items-center gap-2">
        <UButton variant="subtle" :loading="loading" @click="fetchAppState">
          {{ t({ en: "Refresh", ru: "Обновить" }) }}
        </UButton>
      </div>
    </div>

    <!-- Content -->
    <UScrollArea class="min-h-0 flex-1">
      <pre v-if="appState" class="text-default p-4 font-mono text-xs leading-relaxed">{{
        formatJson(appState)
      }}</pre>
      <div v-else class="text-muted p-4 text-sm">
        {{ t({ en: "Loading...", ru: "Загрузка..." }) }}
      </div>
    </UScrollArea>
  </div>
</template>
