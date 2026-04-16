<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue"
import { useI18n } from "vue-i18n"
import * as nuxtLocales from "@nuxt/ui/locale"
import AppSidebar from "@/components/AppSidebar.vue"
import { evento } from "@/evento"

const { locale, t } = useI18n()
const toast = useToast()
const appLocale = computed(
  () => (nuxtLocales as Record<string, (typeof nuxtLocales)["en"]>)[locale.value] ?? nuxtLocales.en,
)

const updateStatus = ref<
  "idle" | "checking" | "available" | "latest" | "error" | "downloading" | "applying"
>("idle")
const currentVersion = ref("")
const latestVersion = ref("")
const dismissedUpdateVersion = ref<string | null>(null)

let unsubscribe: (() => void) | null = null

function showUpdateToast() {
  if (updateStatus.value !== "available" || !latestVersion.value) return
  if (dismissedUpdateVersion.value === latestVersion.value) return

  toast.add({
    id: "app-update",
    title: t("common.updateAvailableTitle"),
    description: t("common.updateAvailableDescription", {
      current: currentVersion.value,
      latest: latestVersion.value,
    }),
    color: "primary",
    duration: 0,
    actions: [
      {
        label: t("common.updateNow"),
        color: "primary",
        variant: "solid",
        onClick: () => {
          evento.emitEvent("updater:start-update", "webview")
        },
      },
      {
        label: t("common.updateLater"),
        color: "neutral",
        variant: "ghost",
        onClick: () => {
          toast.remove("app-update")
          evento.emitEvent("app-state:dismiss-update", { version: latestVersion.value }, "webview")
          dismissedUpdateVersion.value = latestVersion.value
        },
      },
    ],
  })
}

function updateToastProgress() {
  if (updateStatus.value === "downloading") {
    toast.update("app-update", {
      title: t("common.downloading"),
      description: undefined,
      actions: [],
    })
  } else if (updateStatus.value === "applying") {
    toast.update("app-update", {
      title: t("common.applying"),
      description: undefined,
      actions: [],
    })
  }
}

function closeUpdateToast() {
  toast.remove("app-update")
}

onMounted(() => {
  unsubscribe = evento.on("updater:update-status", (ctx) => {
    const prevStatus = updateStatus.value
    updateStatus.value = ctx.payload.status
    currentVersion.value = ctx.payload.current_version || ""
    latestVersion.value = ctx.payload.latest_version || ""

    if (ctx.payload.status === "available") {
      showUpdateToast()
    } else if (ctx.payload.status === "downloading" || ctx.payload.status === "applying") {
      if (prevStatus === "available") {
        updateToastProgress()
      }
    } else if (ctx.payload.status === "latest" || ctx.payload.status === "error") {
      closeUpdateToast()
      dismissedUpdateVersion.value = null
    }
  })

  evento.on("app-state:clear-dismissed-update", () => {
    dismissedUpdateVersion.value = null
  })
})

onUnmounted(() => {
  unsubscribe?.()
})
</script>

<template>
  <UApp :locale="appLocale">
    <div class="flex h-screen">
      <AppSidebar :update-available="updateStatus === 'available'" />

      <!-- Основной контент -->
      <main class="flex-1 overflow-auto">
        <RouterView />
      </main>
    </div>
  </UApp>
</template>
