<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue"
import { useI18n } from "vue-i18n"
import { evento } from "@/evento"

const { t } = useI18n()

const appState = ref<Record<string, unknown> | null>(null)
const loading = ref(false)

let unsubscribe: (() => void) | null = null

function fetchAppState() {
  loading.value = true
  evento.emitEvent("app-state:request-state", "webview")
}

onMounted(() => {
  unsubscribe = evento.on("app-state:restore-state", (ctx) => {
    appState.value = { ...ctx.payload }
    loading.value = false
  })

  fetchAppState()
})

onUnmounted(() => {
  unsubscribe?.()
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
  <div class="flex h-full flex-col bg-[var(--ui-bg)]">
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-[var(--ui-border)] px-4 py-3">
      <div class="flex items-center gap-3">
        <h1 class="text-xl font-bold">{{ t("common.state") }}</h1>
      </div>
      <div class="flex items-center gap-2">
        <UButton variant="subtle" :loading="loading" @click="fetchAppState">
          {{ t("common.refresh") }}
        </UButton>
      </div>
    </div>

    <!-- Content -->
    <UScrollArea class="min-h-0 flex-1">
      <pre v-if="appState" class="p-4 font-mono text-xs leading-relaxed text-[var(--ui-text)]">{{
        formatJson(appState)
      }}</pre>
      <div v-else class="p-4 text-sm text-[var(--ui-text-muted)]">
        {{ t("common.loading") }}
      </div>
    </UScrollArea>
  </div>
</template>
