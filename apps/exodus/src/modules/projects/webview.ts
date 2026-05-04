import { edem } from "@/edem"
import type { Router } from "vue-router"
import { ref, onMounted, onUnmounted, watch, type ComputedRef, type Ref } from "vue"

export interface Project {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  color: string | null
  type: string
  sort_order: number
  created_at: number
  updated_at: number
}

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

const PROJECT_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#a855f7",
  "#ec4899",
]

function getRandomColor(): string {
  return PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)]
}

function toProject(item: {
  id: string
  data: Record<string, unknown>
  created_at: number
  updated_at: number
}): Project {
  return {
    id: item.id,
    name: String(item.data.name ?? ""),
    slug: String(item.data.slug ?? ""),
    description: (item.data.description as string) ?? null,
    icon: (item.data.icon as string) ?? null,
    color: (item.data.color as string) ?? null,
    type: (item.data.type as string) ?? "desktop",
    sort_order: (item.data.sort_order as number) ?? 0,
    created_at: item.created_at,
    updated_at: item.updated_at,
  }
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

export function useProjects() {
  const projects = ref<Project[]>([])
  const loading = ref(true)
  const unsubs: (() => void)[] = []

  onMounted(async () => {
    try {
      const { items } = await edem.data.queryItems({ collection_id: "projects" })
      projects.value = items.map(toProject)
    } catch (err) {
      console.error("[projects] failed to load list:", err)
    } finally {
      loading.value = false
    }

    unsubs.push(
      edem.data.itemCreated(async ({ event: item }) => {
        if (item.collection_id !== "projects") return
        if (projects.value.some((p) => p.id === item.id)) return
        projects.value.push(toProject(item))
      }),
    )

    unsubs.push(
      edem.data.itemUpdated(async ({ event: item }) => {
        if (item.collection_id !== "projects") return
        const idx = projects.value.findIndex((p) => p.id === item.id)
        if (idx !== -1) {
          projects.value[idx] = toProject(item)
        }
      }),
    )

    unsubs.push(
      edem.data.itemDeleted(async ({ event }) => {
        projects.value = projects.value.filter((p) => p.id !== event.item_id)
      }),
    )
  })

  onUnmounted(() => {
    for (const unsub of unsubs) unsub()
    unsubs.length = 0
  })

  async function create(name: string = "Untitled", color?: string) {
    const slug = `${name.toLowerCase().replace(/\s+/g, "-")}-${crypto.randomUUID().slice(0, 8)}`
    const { id } = await edem.data.createItem({
      collection_id: "projects",
      data: {
        name,
        slug,
        color: color ?? getRandomColor(),
        type: "desktop",
        sort_order: 0,
      },
    })
    return id
  }

  async function update(id: string, data: { name?: string; color?: string }) {
    await edem.data.updateItem({ item_id: id, data })
  }

  async function remove(id: string) {
    await edem.data.deleteItem({ item_id: id })
  }

  async function createAndOpen(router: Router) {
    const id = await create()
    router.push(`/project/${id}/overview`)
  }

  return { projects, loading, create, update, remove, createAndOpen }
}

export function useProject(id: string | Ref<string>) {
  const { projects } = useProjects()

  return {
    get project() {
      const projectId = typeof id === "string" ? id : id.value
      return projects.value.find((p) => p.id === projectId) ?? null
    },
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
