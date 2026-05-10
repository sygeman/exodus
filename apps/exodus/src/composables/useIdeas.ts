import { edem } from "@/edem"
import type { Router } from "vue-router"
import { ref, onMounted, onUnmounted, watch, type ComputedRef, type Ref } from "vue"

export interface Idea {
  id: string
  collection_id: string
  title: string
  description: string | null
  level: string | null
  type: string | null
  status: string
  created_at: number
  updated_at: number
}

function toIdea(item: {
  id: string
  collection_id: string
  data: Record<string, unknown>
  created_at: number
  updated_at: number
}): Idea {
  return {
    id: item.id,
    collection_id: item.collection_id,
    title: String(item.data.title ?? ""),
    description: (item.data.description as string) ?? null,
    level: (item.data.level as string) ?? null,
    type: (item.data.type as string) ?? null,
    status: (item.data.status as string) ?? "draft",
    created_at: item.created_at,
    updated_at: item.updated_at,
  }
}

export function useIdeas(projectId: ComputedRef<string> | Ref<string>) {
  const ideas = ref<Idea[]>([])
  const loading = ref(true)
  const unsubs: (() => void)[] = []

  async function load() {
    loading.value = true
    try {
      const { items } = await edem.data.queryItems({
        collection_id: "ideas",
        filter: { project_id: { _eq: projectId.value } },
      })
      ideas.value = items.map(toIdea).toSorted((a, b) => b.created_at - a.created_at)
    } catch (err) {
      console.error("[ideas] failed to load list:", err)
    } finally {
      loading.value = false
    }
  }

  function subscribe() {
    unsubs.push(
      edem.data.itemCreated(async ({ event: item }) => {
        if (item.collection_id !== "ideas") return
        if (item.data.project_id !== projectId.value) return
        if (ideas.value.some((i) => i.id === item.id)) return
        ideas.value.unshift(toIdea(item))
      }),
    )

    unsubs.push(
      edem.data.itemUpdated(async ({ event: item }) => {
        if (item.collection_id !== "ideas") return
        if (item.data.project_id !== projectId.value) return
        const idx = ideas.value.findIndex((i) => i.id === item.id)
        if (idx !== -1) {
          ideas.value[idx] = toIdea(item)
        }
      }),
    )

    unsubs.push(
      edem.data.itemDeleted(async ({ event: payload }) => {
        ideas.value = ideas.value.filter((i) => i.id !== payload.item_id)
      }),
    )
  }

  onMounted(async () => {
    await load()
    subscribe()
  })

  onUnmounted(() => {
    for (const unsub of unsubs) unsub()
    unsubs.length = 0
  })

  watch(
    () => projectId.value,
    () => {
      load()
    },
  )

  async function create(data: {
    title: string
    description?: string
    level?: string
    type?: string
  }) {
    await edem.data.createItem({
      collection_id: "ideas",
      data: { project_id: projectId.value, ...data, status: "draft" },
    })
  }

  async function update(
    id: string,
    data: Partial<{
      title: string
      description: string | null
      level: string | null
      type: string | null
      status: string
    }>,
  ) {
    await edem.data.updateItem({ item_id: id, data })
  }

  async function remove(id: string) {
    await edem.data.deleteItem({ item_id: id })
  }

  async function createAndOpen(router: Router, projectIdValue: string) {
    const { id } = await edem.data.createItem({
      collection_id: "ideas",
      data: { project_id: projectIdValue, title: "Untitled", status: "draft" },
    })
    router.push(`/project/${projectIdValue}/ideas/${id}`)
  }

  return { ideas, loading, create, update, remove, createAndOpen, reload: load }
}
