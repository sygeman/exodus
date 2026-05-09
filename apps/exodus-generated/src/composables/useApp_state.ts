import { ref, watchEffect } from "vue"
import { edem } from "@/edem"

export interface App_stateItem {
  id: string
  last_route: unknown | null
  locale: string | null
  theme: string | null
  window_frame: unknown | null
  window_maximized: boolean | null
}

export function useApp_state() {
  const item = ref<App_stateItem | null>(null)
  const loading = ref(true)

  async function load() {
    loading.value = true
    try {
      const result = await edem.data.queryItems({
        collection_id: "app_state",
      })
      if (result.items.length > 0) {
        item.value = result.items[0] as App_stateItem
      }
    } finally {
      loading.value = false
    }
  }

  watchEffect(() => {
    load()
  })

  async function update(data: Record<string, unknown>) {
    if (!item.value) return
    const result = await edem.data.updateItem({ item_id: item.value.id, data })
    await load()
    return result
  }

  return { item, loading, update, reload: load }
}
