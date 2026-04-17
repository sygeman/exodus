<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "vue-i18n"
import { evento } from "@/evento"
import { useUpdaterStatus } from "@/modules/updater/composables/useUpdaterStatus"

const { t } = useI18n()
const { updateStatus, latestVersion } = useUpdaterStatus()

const version = __APP_VERSION__

const isUpdateAvailable = computed(() => updateStatus.value === "available")

function startUpdate() {
  evento.emitEvent("updater:start-update", "webview")
}
</script>

<template>
  <div class="flex h-8 items-center justify-end px-4">
    <UButton v-if="isUpdateAvailable" color="primary" variant="soft" size="xs" @click="startUpdate">
      {{ t("updater.updateTo") }} v{{ latestVersion }}
    </UButton>
    <UBadge v-else color="neutral" variant="subtle" size="sm">
      {{ version }}
    </UBadge>
  </div>
</template>
