<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue"
import { useI18n } from "vue-i18n"
import { evento } from "@/mainview/evento"

const { t } = useI18n()

const appVersion = __APP_VERSION__

const updateStatus = ref<
  "idle" | "checking" | "available" | "latest" | "error" | "downloading" | "applying"
>("idle")
const updateError = ref<string>("")
const currentVersion = ref<string>("")
const latestVersion = ref<string>("")

let unsubscribe: (() => void) | null = null

onMounted(() => {
  unsubscribe = evento.on("updater:update-status", (ctx) => {
    updateStatus.value = ctx.payload.status
    updateError.value = ctx.payload.error || ""
    currentVersion.value = ctx.payload.current_version || ""
    latestVersion.value = ctx.payload.latest_version || ""
  })

  evento.emitEvent("updater:check-update", "webview")
})

onUnmounted(() => {
  unsubscribe?.()
})

function checkForUpdate() {
  evento.emitEvent("updater:check-update", "webview")
}

function startUpdate() {
  evento.emitEvent("updater:start-update", "webview")
}

const statusText = computed(() => {
  switch (updateStatus.value) {
    case "checking":
      return t("common.checking")
    case "available":
      return t("common.updateAvailable")
    case "latest":
      return t("common.upToDate")
    case "downloading":
      return t("common.downloading")
    case "applying":
      return t("common.applying")
    case "error":
      return t("common.updateError")
    default:
      return ""
  }
})

const showInstallButton = computed(() => updateStatus.value === "available")
const isLoading = computed(() =>
  ["checking", "downloading", "applying"].includes(updateStatus.value),
)
</script>

<template>
  <section class="flex flex-col gap-8">
    <!-- Версия -->
    <div class="flex items-start justify-between gap-4 border-b border-[var(--ui-border)] pb-8">
      <div class="flex flex-col gap-1">
        <h3 class="text-base font-medium">{{ t("common.version") }}</h3>
        <p class="text-sm text-[var(--ui-text-muted)]">{{ t("settings.versionDescription") }}</p>
      </div>
      <span class="font-mono text-sm text-[var(--ui-text-muted)]">v{{ appVersion }}</span>
    </div>

    <!-- Обновление -->
    <div class="flex items-start justify-between gap-4 border-b border-[var(--ui-border)] pb-8">
      <div class="flex flex-col gap-1">
        <h3 class="text-base font-medium">{{ t("common.update") }}</h3>
        <p class="text-sm text-[var(--ui-text-muted)]">{{ t("settings.updateDescription") }}</p>
      </div>
      <div class="flex min-w-0 flex-col items-end gap-3">
        <div class="flex flex-wrap items-center justify-end gap-2">
          <span
            v-if="updateStatus !== 'idle'"
            class="text-sm"
            :class="{
              'text-[var(--ui-success)]': updateStatus === 'available',
              'text-[var(--ui-text-muted)]':
                updateStatus === 'latest' || updateStatus === 'checking',
              'text-[var(--ui-error)]': updateStatus === 'error',
              'text-[var(--ui-primary)]':
                updateStatus === 'downloading' || updateStatus === 'applying',
            }"
          >
            {{ statusText }}
          </span>
          <UBadge
            v-if="updateStatus === 'available' && latestVersion"
            color="success"
            variant="subtle"
            size="sm"
          >
            v{{ latestVersion }}
          </UBadge>
        </div>

        <UButton v-if="showInstallButton" color="success" size="sm" @click="startUpdate">
          {{ t("common.install") }}
        </UButton>
        <UButton
          v-else
          variant="soft"
          size="sm"
          :loading="isLoading"
          :disabled="isLoading"
          @click="checkForUpdate"
        >
          {{ t("common.check") }}
        </UButton>

        <div
          v-if="updateStatus === 'error' && updateError"
          class="max-w-[240px] text-right text-xs leading-tight text-[var(--ui-error)]"
        >
          {{ updateError }}
        </div>
      </div>
    </div>
  </section>
</template>
