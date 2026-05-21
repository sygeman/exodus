import { describe, expect, it } from "bun:test"
import { parseManifests, type Manifests } from "./parse"

describe("parseManifests", () => {
  it("derives flow trigger from trigger node source when top-level trigger is omitted", () => {
    const manifests: Manifests = {
      routes: {
        routes: [],
        components: {},
      },
      components: {},
      data: { collections: [] },
      flows: {
        flows: [
          {
            id: "flow-1",
            name: "Flow 1",
            kind: "flow",
            nodes: [
              {
                id: "trigger",
                type: "trigger",
                position: { x: 0, y: 0 },
                data: { source: { type: "event", event: "item:created:tasks" } },
              },
            ],
            edges: [],
          },
        ],
      },
    }

    const ir = parseManifests(manifests, "test")

    expect(ir.flows).toHaveLength(1)
    expect(ir.flows[0]?.kind).toBe("flow")
    expect(ir.flows[0]?.trigger).toEqual({ type: "event", event: "item:created:tasks" })
  })
})
