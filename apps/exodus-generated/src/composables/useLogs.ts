import { ref, watchEffect } from "vue"
import { edem } from "@/edem"

export interface LogsItem {
  id: string
  level: string
  message: string
  source: string
  args: unknown | null
  count: number | null
}

export function useLogs(options?: { filter?: Record<string, unknown> }) {
  const items = ref<LogsItem[]>([])
  const loading = ref(true)
  const unsubs: (() => void)[] = []

  async function load(filter?: Record<string, unknown>) {
    loading.value = true
    try {
      const result = await edem.data.queryItems({
        collection_id: "logs",
        filter: filter ?? options?.filter ?? {},
      })
      items.value = result.items as LogsItem[]
    } finally {
      loading.value = false
    }
  }

  function subscribe() {
    unsubs.push(
      edem.data.itemCreated(async ({ event: item }) => {
        if (item.collection_id !== "logs") return
        if (items.value.some((i) => i.id === item.id)) return
        items.value.push(item as LogsItem)
      }),
    )
    unsubs.push(
      edem.data.itemUpdated(async ({ event: item }) => {
        if (item.collection_id !== "logs") return
        const idx = items.value.findIndex((i) => i.id === item.id)
        if (idx !== -1) items.value[idx] = item as LogsItem
      }),
    )
    unsubs.push(
      edem.data.itemDeleted(async ({ event }) => {
        items.value = items.value.filter((i) => i.id !== event.item_id)
      }),
    )
  }

  watchEffect(() => {
    load()
    subscribe()
  })

  async function create(data: Record<string, unknown>) {
    const result = await edem.data.createItem({ collection_id: "logs", data })
    await load()
    return result
  }

  async function update(id: string, data: Record<string, unknown>) {
    const result = await edem.data.updateItem({ item_id: id, data })
    await load()
    return result
  }

  async function remove(id: string) {
    await edem.data.deleteItem({ item_id: id })
    await load()
  }

  return { items, loading, create, update, remove, reload: load }
}
