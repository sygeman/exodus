import { z } from "zod"
import { createRegistry } from "@/lib/evento/registry"

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  created_at: z.number(),
})

export type Project = z.infer<typeof ProjectSchema>

export const IdeaSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  level: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
  status: z.string(),
  created_at: z.number(),
  updated_at: z.number(),
})

export type Idea = z.infer<typeof IdeaSchema>

export const projectsRegistry = createRegistry("projects", {
  list: {
    schema: z.void(),
    response: z.object({ projects: z.array(ProjectSchema) }),
  },
  create: {
    schema: z.object({
      name: z.string(),
      color: z.string().optional(),
    }),
  },
  update: {
    schema: z.object({
      id: z.string(),
      name: z.string().optional(),
      color: z.string().optional(),
    }),
  },
  delete: {
    schema: z.object({ id: z.string() }),
  },
  created: {
    schema: ProjectSchema,
  },
  updated: {
    schema: ProjectSchema,
  },
  deleted: {
    schema: z.object({ id: z.string() }),
  },
})

export const ideasRegistry = createRegistry("ideas", {
  list: {
    schema: z.object({ project_id: z.string() }),
    response: z.object({ ideas: z.array(IdeaSchema) }),
  },
  create: {
    schema: z.object({
      project_id: z.string(),
      title: z.string(),
      description: z.string().optional(),
      level: z.string().optional(),
      type: z.string().optional(),
    }),
  },
  update: {
    schema: z.object({
      id: z.string(),
      title: z.string().optional(),
      description: z.string().nullable().optional(),
      level: z.string().nullable().optional(),
      type: z.string().nullable().optional(),
      status: z.string().optional(),
    }),
  },
  delete: {
    schema: z.object({ id: z.string() }),
  },
  created: {
    schema: IdeaSchema,
  },
  updated: {
    schema: IdeaSchema,
  },
  deleted: {
    schema: z.object({ id: z.string() }),
  },
})

export type ProjectsEventMap = {
  "projects:list": void
  "projects:list:response": { projects: Project[] }
  "projects:create": { name: string; color?: string }
  "projects:update": { id: string; name?: string; color?: string }
  "projects:delete": { id: string }
  "projects:created": Project
  "projects:updated": Project
  "projects:deleted": { id: string }

  "ideas:list": { project_id: string }
  "ideas:list:response": { ideas: Idea[] }
  "ideas:create": {
    project_id: string
    title: string
    description?: string
    level?: string
    type?: string
  }
  "ideas:update": {
    id: string
    title?: string
    description?: string
    level?: string
    type?: string
    status?: string
  }
  "ideas:delete": { id: string }
  "ideas:created": Idea
  "ideas:updated": Idea
  "ideas:deleted": { id: string }
}
