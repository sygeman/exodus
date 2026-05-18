import { ref, onMounted, onUnmounted } from "vue"
import { edem } from "@/edem"

export interface App_stateItem {
  id: string
  last_route: unknown | null
  locale: string | null
  locales: unknown | null
  dark: boolean | null
  window_frame: unknown | null
  window_maximized: boolean | null
}

export function useApp_state() {
  const item = ref<App_stateItem | null>(null)
  const loading = ref(true)
  let unsub: (() => void) | null = null

  async function load() {
    loading.value = true
    try {
      const result = await edem.data.getSingleton({
        collection_id: "app_state",
      })
      item.value = result.item as App_stateItem | null
    } finally {
      loading.value = false
    }
  }

  onMounted(async () => {
    await load()
    unsub = edem.data.itemUpdated(({ event }) => {
      if (event.collection_id === "app_state") {
        item.value = event as App_stateItem
      }
    })
  })

  onUnmounted(() => {
    unsub?.()
    unsub = null
  })

  async function update(data: Record<string, unknown>) {
    const result = await edem.data.updateSingleton({
      collection_id: "app_state",
      data,
    })
    return result
  }

  return { item, loading, update, reload: load }
}
