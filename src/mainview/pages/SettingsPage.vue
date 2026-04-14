<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue"
import { useI18n } from "vue-i18n"
import { useColorMode } from "@vueuse/core"
import { locales } from "@/mainview/locales"
import { evento } from "@/mainview/evento"

const { t, locale } = useI18n()

const colorMode = useColorMode()

const isDark = computed({
  get() {
    return colorMode.value === "dark"
  },
  set(_isDark: boolean) {
    colorMode.store.value = _isDark ? "dark" : "light"
  },
})

const themeIcon = computed(() => (isDark.value ? "i-lucide-sun" : "i-lucide-moon"))
const themeText = computed(() => (isDark.value ? t("common.lightMode") : t("common.darkMode")))

const currentLocale = computed(() => locales.find((l) => l.value === locale.value) ?? locales[0])

function setLocale(value: string) {
  locale.value = value as "en" | "pl" | "ru"
}

const localeItems = computed(() =>
  locales.map((l) => ({
    label: `${l.flag} ${l.label}`,
    value: l.value,
    onSelect: () => setLocale(l.value),
  })),
)

const appVersion = __APP_VERSION__

const updateStatus = ref<
  "idle" | "checking" | "available" | "latest" | "error" | "downloading" | "applying"
>("idle")
const updateError = ref<string>("")
const currentVersion = ref<string>("")
const latestVersion = ref<string>("")

let unsubscribe: (() => void) | null = null

onMounted(() => {
  unsubscribe = evento.on("app:updateStatus", (ctx) => {
    updateStatus.value = ctx.payload.status
    updateError.value = ctx.payload.error || ""
    currentVersion.value = ctx.payload.currentVersion || ""
    latestVersion.value = ctx.payload.latestVersion || ""
  })

  evento.emitEvent("app:checkUpdate", "webview")
})

onUnmounted(() => {
  unsubscribe?.()
})

function checkForUpdate() {
  evento.emitEvent("app:checkUpdate", "webview")
}

function startUpdate() {
  evento.emitEvent("app:startUpdate", "webview")
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
      return t("common.downloading") || "Downloading..."
    case "applying":
      return t("common.applying") || "Applying..."
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
  <div class="p-8 flex flex-col items-center gap-6">
    <h1 class="text-2xl font-bold">{{ t("common.settings") }}</h1>

    <div class="w-full max-w-sm flex flex-col gap-4">
      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-2">
          <UIcon :name="themeIcon" class="w-5 h-5 text-[var(--ui-text-muted)]" />
          <span class="text-sm">{{ themeText }}</span>
        </div>
        <USwitch v-model="isDark" />
      </div>

      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-globe" class="w-5 h-5 text-[var(--ui-text-muted)]" />
          <span class="text-sm">{{ t("common.language") }}</span>
        </div>
        <UDropdownMenu :items="localeItems">
          <UButton variant="soft" size="sm" trailing-icon="i-lucide-chevron-down">
            {{ currentLocale.flag }} {{ currentLocale.label }}
          </UButton>
        </UDropdownMenu>
      </div>

      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-info" class="w-5 h-5 text-[var(--ui-text-muted)]" />
          <span class="text-sm">{{ t("common.version") }}</span>
        </div>
        <span class="text-sm text-[var(--ui-text-muted)] font-mono">{{ appVersion }}</span>
      </div>

      <div class="flex items-start justify-between gap-4">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-refresh-cw" class="w-5 h-5 text-[var(--ui-text-muted)]" />
          <span class="text-sm">{{ t("common.update") }}</span>
        </div>
        <div class="flex flex-col items-end gap-2 min-w-0">
          <div class="flex items-center gap-2 flex-wrap justify-end">
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
            class="text-xs text-[var(--ui-error)] text-right max-w-[220px] leading-tight"
          >
            {{ updateError }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
