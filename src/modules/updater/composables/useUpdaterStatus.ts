import { ref, onMounted, onUnmounted } from "vue"
import { evento } from "@/evento"

const updateStatus = ref<
  "idle" | "checking" | "available" | "latest" | "error" | "downloading" | "applying"
>("idle")
const currentVersion = ref("")
const latestVersion = ref("")

let unsubscribe: (() => void) | null = null
let listenerCount = 0

export function useUpdaterStatus() {
  onMounted(() => {
    listenerCount++
    if (listenerCount === 1) {
      unsubscribe = evento.on("updater:update-status", (ctx) => {
        updateStatus.value = ctx.payload.status
        currentVersion.value = ctx.payload.current_version || ""
        latestVersion.value = ctx.payload.latest_version || ""
      })
    }
  })

  onUnmounted(() => {
    listenerCount--
    if (listenerCount === 0) {
      unsubscribe?.()
      unsubscribe = null
    }
  })

  return { updateStatus, currentVersion, latestVersion }
}
