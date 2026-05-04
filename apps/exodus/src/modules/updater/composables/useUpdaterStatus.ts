import { ref, onMounted, onUnmounted } from "vue"
import { edem } from "@/edem"

const COLLECTION_ID = "updater_status"

const updateStatus = ref<
  "idle" | "checking" | "available" | "latest" | "error" | "downloading" | "applying"
>("idle")
const currentVersion = ref("")
const latestVersion = ref("")

let unsubscribe: (() => void) | null = null
let listenerCount = 0

export function useUpdaterStatus() {
  onMounted(async () => {
    listenerCount++
    if (listenerCount === 1) {
      try {
        const { items } = await edem.data.queryItems({ collection_id: COLLECTION_ID })
        if (items.length > 0) {
          const item = items[0]
          updateStatus.value = (item.data.status as typeof updateStatus.value) ?? "idle"
          currentVersion.value = (item.data.current_version as string) ?? ""
          latestVersion.value = (item.data.latest_version as string) ?? ""
        }
      } catch {
        // ignore
      }

      unsubscribe = edem.data.itemUpdated(async ({ event: item }) => {
        if (item.collection_id !== COLLECTION_ID) return
        updateStatus.value = (item.data.status as typeof updateStatus.value) ?? "idle"
        currentVersion.value = (item.data.current_version as string) ?? ""
        latestVersion.value = (item.data.latest_version as string) ?? ""
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
