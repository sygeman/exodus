import type { EventoBun } from "@/bun/evento"
import { projectsRegistry, ideasRegistry, type Project, type Idea } from "@/modules/projects/events"
import {
  migrate,
  listProjects,
  createProject,
  updateProject,
  deleteProject,
  listIdeas,
  getIdeaById,
  createIdea,
  updateIdea,
  deleteIdea,
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

  evento.register(ideasRegistry)

  evento.handle("ideas:list", (ctx) => {
    return { ideas: listIdeas(ctx.payload.project_id) }
  })

  evento.on("ideas:create", (ctx) => {
    const now = Date.now()
    const idea: Idea = {
      id: crypto.randomUUID(),
      project_id: ctx.payload.project_id,
      title: ctx.payload.title,
      description: ctx.payload.description,
      level: ctx.payload.level,
      type: ctx.payload.type,
      status: "draft",
      created_at: now,
      updated_at: now,
    }
    try {
      createIdea(idea)
      evento.emitEvent("ideas:created", idea, "bun")
    } catch (err) {
      console.error("[ideas] create failed:", err)
    }
  })

  evento.on("ideas:update", (ctx) => {
    const { id, ...data } = ctx.payload
    try {
      updateIdea(id, data)
      const updated = getIdeaById(id)
      if (updated) {
        evento.emitEvent("ideas:updated", updated, "bun")
      }
    } catch (err) {
      console.error("[ideas] update failed:", err)
    }
  })

  evento.on("ideas:delete", (ctx) => {
    try {
      deleteIdea(ctx.payload.id)
      evento.emitEvent("ideas:deleted", { id: ctx.payload.id }, "bun")
    } catch (err) {
      console.error("[ideas] delete failed:", err)
    }
  })
}
