import { z } from "zod"
import { createRegistry } from "@/lib/evento/registry"

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  created_at: z.number(),
})

export type Project = z.infer<typeof ProjectSchema>

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

export type ProjectsEventMap = {
  "projects:list": void
  "projects:list:response": { projects: Project[] }
  "projects:create": { name: string; color?: string }
  "projects:update": { id: string; name?: string; color?: string }
  "projects:delete": { id: string }
  "projects:created": Project
  "projects:updated": Project
  "projects:deleted": { id: string }
}
