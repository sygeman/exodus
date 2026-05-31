import { ref, watchEffect } from "vue"
import { edem } from "@/edem"

export interface Project_ui_routesItem {
  id: string
  project_id: string
  manifest_id: string
  path: string
  root: string | null
  redirect: string | null
  parent_manifest_id: string | null
  sort_order: number | null
}

export function useProject_ui_routes(options?: {
  filter?: Record<string, unknown>
  sort?: string[]
}) {
  const items = ref<Project_ui_routesItem[]>([])
  const loading = ref(true)
  const unsubs: (() => void)[] = []

  async function load(filter?: Record<string, unknown>) {
    loading.value = true
    try {
      const result = await edem.data.queryItems({
        collection_id: "project_ui_routes",
        filter: filter ?? options?.filter ?? {},
        sort: options?.sort,
      })
      items.value = result.items as Project_ui_routesItem[]
    } finally {
      loading.value = false
    }
  }

  function subscribe() {
    unsubs.push(
      edem.data.itemCreated(async ({ event: item }) => {
        if (item.collection_id !== "project_ui_routes") return
        if (items.value.some((i) => i.id === item.id)) return
        items.value.push(item as Project_ui_routesItem)
      }),
    )
    unsubs.push(
      edem.data.itemUpdated(async ({ event: item }) => {
        if (item.collection_id !== "project_ui_routes") return
        const idx = items.value.findIndex((i) => i.id === item.id)
        if (idx !== -1) items.value[idx] = item as Project_ui_routesItem
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
    const result = await edem.data.createItem({ collection_id: "project_ui_routes", data })
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
