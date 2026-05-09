import { ref, watchEffect } from "vue"
import { edem } from "@/edem"

export interface Updater_statusItem {
  id: string
  status: string
  current_version: string | null
  latest_version: string | null
  error: string | null
}

export function useUpdater_status() {
  const item = ref<Updater_statusItem | null>(null)
  const loading = ref(true)

  async function load() {
    loading.value = true
    try {
      const result = await edem.data.queryItems({
        collection_id: "updater_status",
      })
      if (result.items.length > 0) {
        item.value = result.items[0] as Updater_statusItem
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
