import type { dataModule, Manifest } from "@exodus/edem-data"
import type { InferModuleAPI } from "@exodus/edem-core"

type EdemData = InferModuleAPI<typeof dataModule>

const SYSTEM_MANIFEST: Manifest = {
  collections: [
    {
      id: "projects",
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
      id: "ideas",
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
    {
      id: "logs",
      name: "Logs",
      fields: [
        { name: "level", type: "string", required: true },
        { name: "message", type: "text", required: true },
        { name: "source", type: "string", required: true },
        { name: "args", type: "json" },
        { name: "count", type: "number" },
      ],
    },
    {
      id: "app_state",
      name: "App State",
      singleton: true,
      fields: [
        { name: "last_route", type: "json" },
        { name: "locale", type: "string" },
        { name: "theme", type: "string" },
        { name: "window_frame", type: "json" },
        { name: "window_maximized", type: "boolean", default: false },
      ],
    },
    {
      id: "updater_status",
      name: "Updater Status",
      singleton: true,
      fields: [
        { name: "status", type: "string", required: true, default: "idle" },
        { name: "current_version", type: "string" },
        { name: "latest_version", type: "string" },
        { name: "error", type: "string" },
      ],
    },
  ],
}

export async function ensureCollections(data: EdemData): Promise<void> {
  await data.applyManifest({ manifest: SYSTEM_MANIFEST })
}
