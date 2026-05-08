import type { FlowsManifest } from "@exodus/edem-flows"

export const SYSTEM_FLOWS_MANIFEST: FlowsManifest = {
  flows: [
    {
      id: "system-updater",
      name: "Auto Updater",
      trigger: { type: "schedule", every: "15m" },
      nodes: [
        { id: "n1", type: "trigger", position: { x: 0, y: 0 } },
        {
          id: "n2",
          type: "action",
          position: { x: 100, y: 0 },
          data: { action: "checkUpdate" },
        },
      ],
      edges: [{ id: "e1", source: "n1", target: "n2" }],
      meta: { system: true, description: "Checks for updates every 15 minutes" },
    },
    {
      id: "system-state-persistence",
      name: "State Persistence",
      trigger: { type: "event", event: "window:frame_changed" },
      nodes: [
        { id: "n1", type: "trigger", position: { x: 0, y: 0 } },
        {
          id: "n2",
          type: "action",
          position: { x: 100, y: 0 },
          data: { action: "saveWindowFrame" },
        },
      ],
      edges: [{ id: "e1", source: "n1", target: "n2" }],
      meta: { system: true, description: "Persists window frame on change" },
    },
    {
      id: "system-route-persistence",
      name: "Route Persistence",
      trigger: { type: "event", event: "app-state:route-changed" },
      nodes: [
        { id: "n1", type: "trigger", position: { x: 0, y: 0 } },
        {
          id: "n2",
          type: "action",
          position: { x: 100, y: 0 },
          data: { action: "saveRoute" },
        },
      ],
      edges: [{ id: "e1", source: "n1", target: "n2" }],
      meta: { system: true, description: "Persists current route on navigation" },
    },
    {
      id: "system-setting-persistence",
      name: "Setting Persistence",
      trigger: { type: "event", event: "app-state:setting-changed" },
      nodes: [
        { id: "n1", type: "trigger", position: { x: 0, y: 0 } },
        {
          id: "n2",
          type: "action",
          position: { x: 100, y: 0 },
          data: { action: "saveSetting" },
        },
      ],
      edges: [{ id: "e1", source: "n1", target: "n2" }],
      meta: { system: true, description: "Persists settings on change" },
    },
  ],
}
