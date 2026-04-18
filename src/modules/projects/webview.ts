import { evento } from "@/evento"
import type { Router } from "vue-router"
import { ref, onMounted, onUnmounted, watch, type ComputedRef, type Ref } from "vue"
import type { Project, Idea } from "@/modules/projects/events"

const DEFAULT_PROJECT_NAME = "Untitled"

export function useProjects() {
  const projects = ref<Project[]>([])
  const loading = ref(true)
  let unsubscribers: (() => void)[] = []

  onMounted(async () => {
    try {
      const res = await evento.request("projects:list", undefined, { timeout: 2000 })
      projects.value = res.projects
    } catch (err) {
      console.error("[projects] failed to load list:", err)
    } finally {
      loading.value = false
    }

    unsubscribers.push(
      evento.on("projects:created", (ctx) => {
        const project = ctx.payload
        if (!projects.value.some((p) => p.id === project.id)) {
          projects.value.push(project)
        }
      }),
    )

    unsubscribers.push(
      evento.on("projects:updated", (ctx) => {
        const project = ctx.payload
        const idx = projects.value.findIndex((p) => p.id === project.id)
        if (idx !== -1) {
          projects.value[idx] = project
        }
      }),
    )

    unsubscribers.push(
      evento.on("projects:deleted", (ctx) => {
        const { id } = ctx.payload
        projects.value = projects.value.filter((p) => p.id !== id)
      }),
    )
  })

  onUnmounted(() => {
    unsubscribers.forEach((unsub) => unsub())
    unsubscribers = []
  })

  function create(name: string = DEFAULT_PROJECT_NAME, color?: string) {
    evento.emitEvent("projects:create", { name, color }, "user:ui")
  }

  function update(id: string, data: { name?: string; color?: string }) {
    evento.emitEvent("projects:update", { id, ...data }, "user:ui")
  }

  function remove(id: string) {
    evento.emitEvent("projects:delete", { id }, "user:ui")
  }

  async function createAndOpen(router: Router) {
    evento.emitEvent("projects:create", { name: DEFAULT_PROJECT_NAME }, "user:ui")

    return new Promise<void>((resolve) => {
      let resolved = false

      const unsub = evento.on("projects:created", (ctx) => {
        if (resolved) return
        resolved = true
        unsub()
        const idx = unsubscribers.indexOf(unsub)
        if (idx !== -1) unsubscribers.splice(idx, 1)
        router.push(`/project/${ctx.payload.id}/overview`)
        resolve()
      })

      unsubscribers.push(unsub)

      setTimeout(() => {
        if (resolved) return
        resolved = true
        unsub()
        const idx = unsubscribers.indexOf(unsub)
        if (idx !== -1) unsubscribers.splice(idx, 1)
        resolve()
      }, 3000)
    })
  }

  return { projects, loading, create, update, remove, createAndOpen }
}

export function useProject(id: string) {
  const { projects } = useProjects()

  return {
    get project() {
      return projects.value.find((p) => p.id === id) ?? null
    },
  }
}

export function useIdeas(projectId: ComputedRef<string> | Ref<string>) {
  const ideas = ref<Idea[]>([])
  const loading = ref(true)
  let unsubscribers: (() => void)[] = []

  async function load() {
    if (loading.value) return
    loading.value = true
    try {
      const res = await evento.request(
        "ideas:list",
        { project_id: projectId.value },
        { timeout: 2000 },
      )
      ideas.value = res.ideas
    } catch (err) {
      console.error("[ideas] failed to load list:", err)
    } finally {
      loading.value = false
    }
  }

  onMounted(async () => {
    try {
      const res = await evento.request(
        "ideas:list",
        { project_id: projectId.value },
        { timeout: 2000 },
      )
      ideas.value = res.ideas
    } catch (err) {
      console.error("[ideas] failed to load list:", err)
    } finally {
      loading.value = false
    }

    unsubscribers.push(
      evento.on("ideas:created", (ctx) => {
        const idea = ctx.payload
        if (idea.project_id !== projectId.value) return
        if (ideas.value.some((i) => i.id === idea.id)) return
        ideas.value.unshift(idea)
      }),
    )

    unsubscribers.push(
      evento.on("ideas:updated", (ctx) => {
        const idea = ctx.payload
        if (idea.project_id !== projectId.value) return
        const idx = ideas.value.findIndex((i) => i.id === idea.id)
        if (idx !== -1) {
          ideas.value[idx] = idea
        }
      }),
    )

    unsubscribers.push(
      evento.on("ideas:deleted", (ctx) => {
        const { id } = ctx.payload
        ideas.value = ideas.value.filter((i) => i.id !== id)
      }),
    )
  })

  watch(
    () => projectId.value,
    () => {
      load()
    },
  )

  onUnmounted(() => {
    unsubscribers.forEach((unsub) => unsub())
    unsubscribers = []
  })

  function create(data: { title: string; description?: string; level?: string; type?: string }) {
    evento.emitEvent("ideas:create", { project_id: projectId.value, ...data }, "user:ui")
  }

  function update(
    id: string,
    data: Partial<Omit<Idea, "id" | "project_id" | "created_at" | "updated_at">>,
  ) {
    evento.emitEvent("ideas:update", { id, ...data }, "user:ui")
  }

  function remove(id: string) {
    evento.emitEvent("ideas:delete", { id }, "user:ui")
  }

  async function createAndOpen(router: Router, projectIdValue: string) {
    evento.emitEvent("ideas:create", { project_id: projectIdValue, title: "Untitled" }, "user:ui")

    return new Promise<void>((resolve) => {
      let resolved = false

      const unsub = evento.on("ideas:created", (ctx) => {
        const idea = ctx.payload
        if (idea.project_id !== projectIdValue) return
        if (resolved) return
        resolved = true
        unsub()
        const idx = unsubscribers.indexOf(unsub)
        if (idx !== -1) unsubscribers.splice(idx, 1)
        router.push(`/project/${projectIdValue}/ideas/${idea.id}`)
        resolve()
      })

      unsubscribers.push(unsub)

      setTimeout(() => {
        if (resolved) return
        resolved = true
        unsub()
        const idx = unsubscribers.indexOf(unsub)
        if (idx !== -1) unsubscribers.splice(idx, 1)
        resolve()
      }, 3000)
    })
  }

  return { ideas, loading, create, update, remove, createAndOpen, reload: load }
}
