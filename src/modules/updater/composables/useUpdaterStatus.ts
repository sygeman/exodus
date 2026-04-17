import { ref, onMounted, onUnmounted } from "vue"
import { evento } from "@/evento"

const updateStatus = ref<
  "idle" | "checking" | "available" | "latest" | "error" | "downloading" | "applying"
>("idle")

let unsubscribe: (() => void) | null = null
let listenerCount = 0

export function useUpdaterStatus() {
  onMounted(() => {
    listenerCount++
    if (listenerCount === 1) {
      unsubscribe = evento.on("updater:update-status", (ctx) => {
        updateStatus.value = ctx.payload.status
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

  return { updateStatus }
}
