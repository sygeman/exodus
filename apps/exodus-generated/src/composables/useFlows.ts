import { ref, watchEffect } from "vue"
import { edem } from "@/edem"

export interface FlowsItem {
  id: string
  project_id: string | null
  name: string
  status: string | null
  trigger: unknown
  nodes: unknown | null
  edges: unknown | null
  meta: unknown | null
  manifest_id: string | null
  backpressure: unknown | null
}

export function useFlows(options?: { filter?: Record<string, unknown>; sort?: string[] }) {
  const items = ref<FlowsItem[]>([])
  const loading = ref(true)
  const unsubs: (() => void)[] = []

  async function load(filter?: Record<string, unknown>) {
    loading.value = true
    try {
      const result = await edem.data.queryItems({
        collection_id: "flows",
        filter: filter ?? options?.filter ?? {},
        sort: options?.sort,
      })
      items.value = result.items as FlowsItem[]
    } finally {
      loading.value = false
    }
  }

  function subscribe() {
    unsubs.push(
      edem.data.itemCreated(async ({ event: item }) => {
        if (item.collection_id !== "flows") return
        if (items.value.some((i) => i.id === item.id)) return
        items.value.push(item as FlowsItem)
      }),
    )
    unsubs.push(
      edem.data.itemUpdated(async ({ event: item }) => {
        if (item.collection_id !== "flows") return
        const idx = items.value.findIndex((i) => i.id === item.id)
        if (idx !== -1) items.value[idx] = item as FlowsItem
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
    const result = await edem.data.createItem({ collection_id: "flows", data })
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
