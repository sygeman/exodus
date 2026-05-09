import { ref, watchEffect } from "vue"
import { edem } from "@/edem"

export interface ProjectsItem {
  id: string
  name: string,
  slug: string,
  description: string | null,
  icon: string | null,
  color: string | null,
  type: string | null,
  sort_order: number | null
}

export function useProjects(options?: { filter?: Record<string, unknown> }) {
  const items = ref<ProjectsItem[]>([])
  const loading = ref(true)
  const unsubs: (() => void)[] = []

  async function load(filter?: Record<string, unknown>) {
    loading.value = true
    try {
      const result = await edem.data.queryItems({
        collection_id: "projects",
        filter: filter ?? options?.filter ?? {},
      })
      items.value = result.items as ProjectsItem[]
    } finally {
      loading.value = false
    }
  }

  function subscribe() {
    unsubs.push(
      edem.data.itemCreated(async ({ event: item }) => {
        if (item.collection_id !== "projects") return
        if (items.value.some((i) => i.id === item.id)) return
        items.value.push(item as ProjectsItem)
      }),
    )
    unsubs.push(
      edem.data.itemUpdated(async ({ event: item }) => {
        if (item.collection_id !== "projects") return
        const idx = items.value.findIndex((i) => i.id === item.id)
        if (idx !== -1) items.value[idx] = item as ProjectsItem
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
    const result = await edem.data.createItem({ collection_id: "projects", data })
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
