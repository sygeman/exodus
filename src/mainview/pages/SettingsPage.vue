<script setup lang="ts">
import { computed, ref, onMounted } from "vue"
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
  locale.value = value as any
}

const localeItems = computed(() =>
  locales.map((l) => ({
    label: `${l.flag} ${l.label}`,
    value: l.value,
    onSelect: () => setLocale(l.value),
  }))
)

const appVersion = __APP_VERSION__

const updateStatus = ref<"idle" | "checking" | "available" | "latest" | "error" | "applying">("idle")
const updateError = ref<string>("")

async function checkForUpdate() {
  updateStatus.value = "checking"
  updateError.value = ""
  try {
    console.log("[settings] checking for update...")
    const response = await evento.request("app:checkUpdate", {})
    console.log("[settings] update response:", response)
    const data = (response as any).data
    if (data.error) {
      updateStatus.value = "error"
      updateError.value = data.error
    } else if (data.updateAvailable) {
      updateStatus.value = "available"
    } else {
      updateStatus.value = "latest"
    }
  } catch (err) {
    console.error("[settings] update check failed:", err)
    updateStatus.value = "error"
    updateError.value = (err as Error).message || String(err)
  }
}

async function applyUpdate() {
  updateStatus.value = "applying"
  updateError.value = ""
  try {
    const response = await evento.request("app:applyUpdate", {})
    const data = (response as any).data
    if (!data.success) {
      updateStatus.value = "error"
      updateError.value = data.error || "Unknown error"
    }
  } catch (err) {
    updateStatus.value = "error"
    updateError.value = (err as Error).message
  }
}

onMounted(() => {
  checkForUpdate()
})
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

      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-refresh-cw" class="w-5 h-5 text-[var(--ui-text-muted)]" />
          <span class="text-sm">{{ t("common.update") }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span
            v-if="updateStatus === 'available'"
            class="text-sm text-[var(--ui-success)]"
          >{{ t("common.updateAvailable") }}</span>
          <span
            v-else-if="updateStatus === 'latest'"
            class="text-sm text-[var(--ui-text-muted)]"
          >{{ t("common.upToDate") }}</span>
          <div
            v-else-if="updateStatus === 'error'"
            class="flex flex-col items-end gap-1"
          >
            <span class="text-sm text-[var(--ui-error)]">{{ t("common.updateError") }}</span>
            <span class="text-xs text-[var(--ui-error)] opacity-80 max-w-[200px] text-right">{{ updateError }}</span>
          </div>
          <UButton
            v-if="updateStatus === 'available'"
            color="success"
            size="sm"
            @click="applyUpdate"
          >
            {{ t("common.install") }}
          </UButton>
          <UButton
            v-else
            variant="soft"
            size="sm"
            :loading="updateStatus === 'checking' || updateStatus === 'applying'"
            :disabled="updateStatus === 'applying'"
            @click="checkForUpdate"
          >
            {{ t("common.check") }}
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
