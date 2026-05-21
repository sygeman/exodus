import { describe, expect, it } from "bun:test"
import { buildProjectFlowsManifest, toProjectFlowManifest } from "./project-flow-source"

describe("project flow source", () => {
  it("converts source item into flow manifest", () => {
    const manifest = toProjectFlowManifest({
      id: "local-flow-id",
      data: {
        name: "Save Project",
        kind: "flow",
        nodes: [
          {
            id: "trigger",
            type: "trigger",
            position: { x: 0, y: 0 },
            data: {
              label: "Trigger",
              nodeType: "trigger",
              source: { type: "event", event: "data.itemCreated", filter: { status: "urgent" } },
            },
          },
        ],
        edges: [],
        meta: { viewport: { x: 0, y: 0, zoom: 1 } },
        manifest_id: "save-project",
        backpressure: { maxConcurrent: 1 },
      },
    })

    expect(manifest).toEqual({
      id: "save-project",
      name: "Save Project",
      kind: "flow",
      nodes: [
        {
          id: "trigger",
          type: "trigger",
          position: { x: 0, y: 0 },
          data: {
            nodeType: "trigger",
            source: { type: "event", event: "data.itemCreated", filter: { status: "urgent" } },
            label: "Trigger",
          },
        },
      ],
      edges: [],
      meta: { viewport: { x: 0, y: 0, zoom: 1 } },
      backpressure: { maxConcurrent: 1, maxPending: undefined },
    })
  })

  it("builds a flows manifest from source items", () => {
    const manifest = buildProjectFlowsManifest([
      {
        id: "flow-1",
        data: {
          name: "First",
          kind: "flow",
          nodes: [],
          edges: [],
        },
      },
    ])

    expect(manifest).toEqual({
      flows: [
        {
          id: "flow-1",
          name: "First",
          kind: "flow",
          nodes: [
            {
              id: "trigger",
              type: "trigger",
              position: { x: 0, y: 0 },
              data: {
                label: "Trigger",
                nodeType: "trigger",
                source: { type: "manual" },
              },
            },
          ],
          edges: [],
          meta: undefined,
          backpressure: undefined,
        },
      ],
    })
  })

  it("keeps trigger source on trigger node", () => {
    const manifest = toProjectFlowManifest({
      id: "flow-1",
      data: {
        name: "First",
        kind: "flow",
        nodes: [
          {
            id: "trigger",
            type: "trigger",
            position: { x: 0, y: 0 },
            data: {
              nodeType: "trigger",
              source: { type: "schedule", every: "1h" },
            },
          },
        ],
        edges: [],
      },
    })

    expect(manifest.nodes[0]?.data?.source).toEqual({ type: "schedule", every: "1h" })
  })

  it("preserves canonical call nodes during manifest build", () => {
    const manifest = toProjectFlowManifest(
      {
        id: "flow-1",
        data: {
          name: "Legacy Action Flow",
          kind: "flow",
          nodes: [
            {
              id: "trigger",
              type: "trigger",
              position: { x: 0, y: 0 },
              data: { nodeType: "trigger", source: { type: "manual" } },
            },
            {
              id: "call",
              type: "call",
              position: { x: 120, y: 0 },
              data: { nodeType: "call", module: "data", procedure: "listCollections" },
            },
          ],
          edges: [{ id: "e1", source: "trigger", target: "call" }],
        },
      },
      [
        {
          module: "data",
          procedures: [
            {
              name: "listCollections",
              kind: "query",
              inputSchema: { mode: "json-schema", schema: { type: "object" } },
              outputSchema: { mode: "json-schema", schema: { type: "object" } },
            },
          ],
        },
      ],
    )

    expect(manifest.nodes.find((node) => node.id === "call")).toEqual({
      id: "call",
      type: "call",
      position: { x: 120, y: 0 },
      data: {
        nodeType: "call",
        module: "data",
        procedure: "listCollections",
      },
    })
  })
})
