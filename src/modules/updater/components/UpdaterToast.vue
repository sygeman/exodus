<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue"
import { useI18n } from "vue-i18n"
import { evento } from "@/evento"
import { useUpdaterStatus } from "@/modules/updater/composables/useUpdaterStatus"

const { t } = useI18n()
const toast = useToast()
const { updateStatus } = useUpdaterStatus()

const currentVersion = ref("")
const latestVersion = ref("")
const dismissedUpdateVersion = ref<string | null>(null)

let unsubscribe: (() => void) | null = null

function showUpdateToast() {
  if (updateStatus.value !== "available" || !latestVersion.value) return
  if (dismissedUpdateVersion.value === latestVersion.value) return

  toast.add({
    id: "app-update",
    title: t("updater.updateAvailableTitle"),
    description: t("updater.updateAvailableDescription", {
      current: currentVersion.value,
      latest: latestVersion.value,
    }),
    color: "primary",
    duration: 0,
    actions: [
      {
        label: t("updater.updateNow"),
        color: "primary",
        variant: "solid",
        onClick: () => {
          evento.emitEvent("updater:start-update", "webview")
        },
      },
      {
        label: t("updater.updateLater"),
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
      title: t("updater.downloading"),
      description: undefined,
      actions: [],
    })
  } else if (updateStatus.value === "applying") {
    toast.update("app-update", {
      title: t("updater.applying"),
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
  <div />
</template>
