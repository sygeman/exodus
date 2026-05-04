import type { dataModule } from "@exodus/edem-data"
import type { InferModuleAPI } from "@exodus/edem-core"

type EdemData = InferModuleAPI<typeof dataModule>

const IDEAS_COLLECTION_SLUG = "ideas"

async function getOrCreateDefaultProjectId(data: EdemData): Promise<string> {
  const { project } = await data.getDefaultProject()
  if (project) return project.id

  const { id } = await data.createProject({
    name: "System",
    slug: "system",
    description: "System project for shared collections",
  })
  return id
}

export async function ensureIdeasCollection(data: EdemData): Promise<void> {
  const { collections } = await data.listCollections({})
  if (collections.some((c) => c.slug === IDEAS_COLLECTION_SLUG)) return

  const projectId = await getOrCreateDefaultProjectId(data)
  await data.createCollection({
    project_id: projectId,
    name: "Ideas",
    slug: IDEAS_COLLECTION_SLUG,
    fields: [
      { name: "project_id", type: "uuid", required: true },
      { name: "title", type: "string", required: true },
      { name: "description", type: "text" },
      { name: "level", type: "string" },
      { name: "type", type: "string" },
      { name: "status", type: "string", default: "draft" },
    ],
  })
}
