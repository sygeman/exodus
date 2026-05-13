export const dataManifest = {
  collections: [
    {
      id: "projects",
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
      id: "flows",
      fields: [
        { name: "project_id", type: "uuid", required: true },
        { name: "name", type: "string", required: true },
        { name: "status", type: "string", default: "draft" },
        { name: "trigger", type: "json", required: true },
        { name: "nodes", type: "json" },
        { name: "edges", type: "json" },
        { name: "meta", type: "json" },
      ],
    },
    {
      id: "logs",
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
      singleton: true,
      fields: [
        { name: "last_route", type: "json" },
        { name: "locale", type: "string" },
        { name: "locales", type: "json" },
        { name: "dark", type: "boolean", default: false },
        { name: "window_frame", type: "json" },
        { name: "window_maximized", type: "boolean", default: false },
      ],
    },
  ],
} as const
