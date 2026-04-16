import type { EventoBun } from "@/bun/evento"
import { projectsRegistry, type Project } from "@/modules/projects/events"
import {
  migrate,
  listProjects,
  createProject,
  updateProject,
  deleteProject,
} from "@/modules/projects/db"
import { PROJECT_COLORS } from "@/modules/projects/constants"

function getRandomColor(): string {
  return PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)]
}

export function initProjects(evento: EventoBun) {
  migrate()
  evento.register(projectsRegistry)

  evento.handle("projects:list", () => {
    return { projects: listProjects() }
  })

  evento.on("projects:create", (ctx) => {
    const project: Project = {
      id: crypto.randomUUID(),
      name: ctx.payload.name,
      color: ctx.payload.color ?? getRandomColor(),
      created_at: Date.now(),
    }
    try {
      createProject(project)
      evento.emitEvent("projects:created", project, "bun")
    } catch (err) {
      console.error("[projects] create failed:", err)
    }
  })

  evento.on("projects:update", (ctx) => {
    const { id, ...data } = ctx.payload
    try {
      updateProject(id, data)
      const updated = listProjects().find((p) => p.id === id)
      if (updated) {
        evento.emitEvent("projects:updated", updated, "bun")
      }
    } catch (err) {
      console.error("[projects] update failed:", err)
    }
  })

  evento.on("projects:delete", (ctx) => {
    try {
      deleteProject(ctx.payload.id)
      evento.emitEvent("projects:deleted", { id: ctx.payload.id }, "bun")
    } catch (err) {
      console.error("[projects] delete failed:", err)
    }
  })
}
