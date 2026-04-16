import { evento } from "@/mainview/evento"
import { projectsRegistry, type Project } from "@/modules/projects/events"
import type { Router } from "vue-router"
import { ref, onMounted, onUnmounted } from "vue"

const DEFAULT_PROJECT_NAME = "Untitled"

export function useProjects() {
  const projects = ref<Project[]>([])
  const loading = ref(true)
  let unsubscribers: (() => void)[] = []

  onMounted(async () => {
    evento.register(projectsRegistry)

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
        const project = ctx.payload as Project
        if (!projects.value.some((p) => p.id === project.id)) {
          projects.value.push(project)
        }
      }),
    )

    unsubscribers.push(
      evento.on("projects:updated", (ctx) => {
        const project = ctx.payload as Project
        const idx = projects.value.findIndex((p) => p.id === project.id)
        if (idx !== -1) {
          projects.value[idx] = project
        }
      }),
    )

    unsubscribers.push(
      evento.on("projects:deleted", (ctx) => {
        const { id } = ctx.payload as { id: string }
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
      const unsub = evento.on("projects:created", (ctx) => {
        const project = ctx.payload as Project
        unsub()
        router.push(`/project/${project.id}`)
        resolve()
      })

      unsubscribers.push(unsub)

      setTimeout(() => {
        unsub()
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
