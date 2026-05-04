import { edem } from "@/edem"
import type { Router } from "vue-router"
import { ref, onMounted, onUnmounted, watch, type ComputedRef, type Ref } from "vue"

export interface Project {
  id: string
  slug: string
  name: string
  description?: string | null
  icon?: string | null
  color?: string | null
  is_default?: boolean | null
  sort_order?: number | null
  created_at: number
  updated_at: number
  deleted_at?: number | null
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
      const res = await edem.data.listProjects()
      projects.value = res.projects
    } catch (err) {
      console.error("[projects] failed to load list:", err)
    } finally {
      loading.value = false
    }

    unsubs.push(
      edem.data.projectCreated(async ({ event: project }) => {
        if (!projects.value.some((p) => p.id === project.id)) {
          projects.value.push(project)
        }
      }),
    )

    unsubs.push(
      edem.data.projectUpdated(async ({ event: project }) => {
        const idx = projects.value.findIndex((p) => p.id === project.id)
        if (idx !== -1) {
          projects.value[idx] = project
        }
      }),
    )

    unsubs.push(
      edem.data.projectDeleted(async ({ event }) => {
        projects.value = projects.value.filter((p) => p.id !== event.project_id)
      }),
    )
  })

  onUnmounted(() => {
    for (const unsub of unsubs) unsub()
    unsubs.length = 0
  })

  async function create(name: string = "Untitled", color?: string) {
    const id = crypto.randomUUID()
    const slug = `${name.toLowerCase().replace(/\s+/g, "-")}-${id.slice(0, 8)}`
    const result = await edem.data.createProject({ name, slug, color: color ?? getRandomColor() })
    return result.id
  }

  async function update(id: string, data: { name?: string; color?: string }) {
    await edem.data.updateProject({ project_id: id, ...data })
  }

  async function remove(id: string) {
    await edem.data.deleteProject({ project_id: id })
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
  let ideasCollectionId: string | null = null
  const unsubs: (() => void)[] = []

  async function resolveCollectionId(): Promise<string | null> {
    if (ideasCollectionId) return ideasCollectionId
    try {
      const { collections } = await edem.data.listCollections({})
      const col = collections.find((c) => c.slug === "ideas")
      if (col) {
        ideasCollectionId = col.id
        return col.id
      }
    } catch (err) {
      console.error("[ideas] failed to resolve collection:", err)
    }
    return null
  }

  async function load() {
    loading.value = true
    try {
      const colId = await resolveCollectionId()
      if (!colId) {
        ideas.value = []
        return
      }
      const { items } = await edem.data.queryItems({
        collection_id: colId,
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
        if (item.data.project_id !== projectId.value) return
        if (ideas.value.some((i) => i.id === item.id)) return
        ideas.value.unshift(toIdea(item))
      }),
    )

    unsubs.push(
      edem.data.itemUpdated(async ({ event: item }) => {
        if (item.data.project_id !== projectId.value) return
        const idx = ideas.value.findIndex((i) => i.id === item.id)
        if (idx !== -1) {
          ideas.value[idx] = toIdea(item)
        }
      }),
    )

    unsubs.push(
      edem.data.itemDeleted(async ({ event: payload }) => {
        const item = ideas.value.find((i) => i.id === payload.item_id)
        if (item) {
          ideas.value = ideas.value.filter((i) => i.id !== payload.item_id)
        }
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
    const colId = await resolveCollectionId()
    if (!colId) throw new Error("[ideas] ideas collection not found")

    await edem.data.createItem({
      collection_id: colId,
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
    const colId = await resolveCollectionId()
    if (!colId) throw new Error("[ideas] ideas collection not found")

    const { id } = await edem.data.createItem({
      collection_id: colId,
      data: { project_id: projectIdValue, title: "Untitled", status: "draft" },
    })
    router.push(`/project/${projectIdValue}/ideas/${id}`)
  }

  return { ideas, loading, create, update, remove, createAndOpen, reload: load }
}
