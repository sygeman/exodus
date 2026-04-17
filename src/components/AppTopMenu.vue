<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "vue-i18n"
import { useRouter } from "vue-router"
import { evento } from "@/evento"
import { useUpdaterStatus } from "@/modules/updater/composables/useUpdaterStatus"

const { t } = useI18n()
const router = useRouter()
const { updateStatus, latestVersion } = useUpdaterStatus()

const version = __APP_VERSION__

const isUpdateAvailable = computed(() => updateStatus.value === "available")

function startUpdate() {
  evento.emitEvent("updater:start-update", "webview")
}

function goBack() {
  router.back()
}

function goForward() {
  router.forward()
}
</script>

<template>
  <div
    class="electrobun-webkit-app-region-drag flex h-8 items-center justify-between px-3 select-none"
  >
    <!-- Навигация назад/вперёд -->
    <div class="electrobun-webkit-app-region-no-drag flex items-center select-none">
      <button
        class="flex h-6 w-6 items-center justify-center rounded text-[var(--ui-text-muted)] transition-colors hover:bg-[var(--ui-bg)] hover:text-[var(--ui-text)]"
        @click="goBack"
      >
        <UIcon name="i-lucide-arrow-left" class="h-3.5 w-3.5" />
      </button>
      <button
        class="flex h-6 w-6 items-center justify-center rounded text-[var(--ui-text-muted)] transition-colors hover:bg-[var(--ui-bg)] hover:text-[var(--ui-text)]"
        @click="goForward"
      >
        <UIcon name="i-lucide-arrow-right" class="h-3.5 w-3.5" />
      </button>
    </div>

    <!-- Версия / Обновление -->
    <div class="electrobun-webkit-app-region-no-drag select-text">
      <UButton
        v-if="isUpdateAvailable"
        color="primary"
        variant="soft"
        size="xs"
        :ui="{ leadingIcon: 'size-3.5' }"
        @click="startUpdate"
      >
        <template #leading>
          <UIcon name="i-lucide-arrow-up-circle" />
        </template>
        {{ t("updater.updateTo") }} v{{ latestVersion }}
      </UButton>
      <UBadge v-else color="neutral" variant="subtle" size="sm">
        {{ version }}
      </UBadge>
    </div>
  </div>
</template>
