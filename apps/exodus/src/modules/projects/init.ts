import type { dataModule, Manifest } from "@exodus/edem-data"
import type { InferModuleAPI } from "@exodus/edem-core"

type EdemData = InferModuleAPI<typeof dataModule>

const SYSTEM_MANIFEST: Manifest = {
  collections: [
    {
      slug: "projects",
      name: "Projects",
      fields: [
        { name: "name", type: "string", required: true },
        { name: "slug", type: "string", required: true },
        { name: "description", type: "text" },
        { name: "icon", type: "string" },
        { name: "color", type: "string" },
        { name: "type", type: "string", default: "desktop" },
        { name: "sort_order", type: "number", default: 0 },
      ],
    },
    {
      slug: "ideas",
      name: "Ideas",
      fields: [
        { name: "project_id", type: "uuid", required: true },
        { name: "title", type: "string", required: true },
        { name: "description", type: "text" },
        { name: "level", type: "string" },
        { name: "type", type: "string" },
        { name: "status", type: "string", default: "draft" },
      ],
    },
  ],
}

export async function ensureCollections(data: EdemData): Promise<void> {
  await data.applyManifest({ manifest: SYSTEM_MANIFEST })
}
