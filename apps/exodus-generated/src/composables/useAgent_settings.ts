import { ref, onMounted, onUnmounted } from "vue"
import { edem } from "@/edem"

export interface Agent_settingsItem {
  id: string
  active_provider_id: string | null
  voice: string | null
  language: string | null
  auto_listen: boolean | null
  volume: number | null
  tts_voice: string | null
  tts_speed: number | null
}

export function useAgent_settings() {
  const item = ref<Agent_settingsItem | null>(null)
  const loading = ref(true)
  let unsub: (() => void) | null = null

  async function load() {
    loading.value = true
    try {
      const result = await edem.data.getSingleton({
        collection_id: "agent_settings",
      })
      item.value = result.item as Agent_settingsItem | null
    } finally {
      loading.value = false
    }
  }

  onMounted(async () => {
    await load()
    unsub = edem.data.itemUpdated(({ event }) => {
      if (event.collection_id === "agent_settings") {
        item.value = event as Agent_settingsItem
      }
    })
  })

  onUnmounted(() => {
    unsub?.()
    unsub = null
  })

  async function update(data: Record<string, unknown>) {
    const result = await edem.data.updateSingleton({
      collection_id: "agent_settings",
      data,
    })
    return result
  }

  return { item, loading, update, reload: load }
}
