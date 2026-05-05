import type { FlowsManifest } from "@exodus/edem-flows"

export const SYSTEM_FLOWS_MANIFEST: FlowsManifest = {
  flows: [
    {
      id: "system-logger",
      name: "System Logger",
      trigger: { type: "event", event: "log:entry" },
      nodes: [
        { id: "n1", type: "trigger", position: { x: 0, y: 0 } },
        {
          id: "n2",
          type: "condition",
          position: { x: 100, y: 0 },
          data: { field: "level", value: "error", operator: "eq" },
        },
        {
          id: "n3",
          type: "action",
          position: { x: 200, y: 0 },
          data: { action: "insertLog" },
        },
        {
          id: "n4",
          type: "action",
          position: { x: 200, y: 100 },
          data: { action: "insertLog" },
        },
      ],
      edges: [
        { id: "e1", source: "n1", target: "n2" },
        { id: "e2", source: "n2", target: "n3", sourceHandle: "true" },
        { id: "e3", source: "n2", target: "n4", sourceHandle: "false" },
      ],
      meta: { system: true, description: "Processes log entries and stores them" },
    },
    {
      id: "system-updater",
      name: "Auto Updater",
      trigger: { type: "schedule", cron: "*/15 * * * *" },
      nodes: [
        { id: "n1", type: "trigger", position: { x: 0, y: 0 } },
        {
          id: "n2",
          type: "action",
          position: { x: 100, y: 0 },
          data: { action: "checkUpdate" },
        },
        {
          id: "n3",
          type: "condition",
          position: { x: 200, y: 0 },
          data: { field: "available", value: true, operator: "eq" },
        },
        {
          id: "n4",
          type: "action",
          position: { x: 300, y: 0 },
          data: { action: "notifyUpdate" },
        },
      ],
      edges: [
        { id: "e1", source: "n1", target: "n2" },
        { id: "e2", source: "n2", target: "n3" },
        { id: "e3", source: "n3", target: "n4", sourceHandle: "true" },
      ],
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
          type: "transform",
          position: { x: 100, y: 0 },
          data: { field: "frame", operation: "set", value: "{{trigger.inputs.frame}}" },
        },
        {
          id: "n3",
          type: "action",
          position: { x: 200, y: 0 },
          data: { action: "saveWindowFrame" },
        },
      ],
      edges: [
        { id: "e1", source: "n1", target: "n2" },
        { id: "e2", source: "n2", target: "n3" },
      ],
      meta: { system: true, description: "Persists window frame on change" },
    },
  ],
}
