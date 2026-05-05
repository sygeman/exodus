import { describe, it, expect, beforeEach } from "bun:test"
import { createEdem } from "@exodus/edem-core"
import { dataModule, resetDataEngine } from "@exodus/edem-data"
import { flowsModule } from "./index"
import type { FlowsManifest } from "./manifest"

describe("flows manifest", () => {
  let edem: ReturnType<typeof createEdem<[typeof dataModule, typeof flowsModule]>>

  beforeEach(async () => {
    resetDataEngine()
    edem = createEdem([dataModule, flowsModule])
  })

  describe("applyManifest", () => {
    it("should create flows from manifest", async () => {
      const manifest: FlowsManifest = {
        flows: [
          {
            id: "test-flow-1",
            name: "Test Flow 1",
            trigger: { type: "manual" },
            nodes: [{ id: "n1", type: "trigger", position: { x: 0, y: 0 } }],
            edges: [],
          },
          {
            id: "test-flow-2",
            name: "Test Flow 2",
            trigger: { type: "event", event: "test:event" },
            nodes: [{ id: "n1", type: "trigger", position: { x: 0, y: 0 } }],
            edges: [],
          },
        ],
      }

      const result = await edem.flows.applyManifest({ manifest })
      expect(result.created).toEqual(["test-flow-1", "test-flow-2"])
      expect(result.updated).toEqual([])
      expect(result.skipped).toEqual([])
    })

    it("should skip unchanged flows", async () => {
      const manifest: FlowsManifest = {
        flows: [
          {
            id: "test-flow",
            name: "Test Flow",
            trigger: { type: "manual" },
            nodes: [{ id: "n1", type: "trigger", position: { x: 0, y: 0 } }],
            edges: [],
          },
        ],
      }

      await edem.flows.applyManifest({ manifest })
      const result = await edem.flows.applyManifest({ manifest })

      expect(result.created).toEqual([])
      expect(result.updated).toEqual([])
      expect(result.skipped).toEqual(["test-flow"])
    })

    it("should update changed flows", async () => {
      const manifest: FlowsManifest = {
        flows: [
          {
            id: "test-flow",
            name: "Test Flow",
            trigger: { type: "manual" },
            nodes: [{ id: "n1", type: "trigger", position: { x: 0, y: 0 } }],
            edges: [],
          },
        ],
      }

      await edem.flows.applyManifest({ manifest })

      const updatedManifest: FlowsManifest = {
        flows: [
          {
            id: "test-flow",
            name: "Updated Flow",
            trigger: { type: "manual" },
            nodes: [
              { id: "n1", type: "trigger", position: { x: 0, y: 0 } },
              { id: "n2", type: "transform", position: { x: 100, y: 0 } },
            ],
            edges: [{ id: "e1", source: "n1", target: "n2" }],
          },
        ],
      }

      const result = await edem.flows.applyManifest({ manifest: updatedManifest })
      expect(result.created).toEqual([])
      expect(result.updated).toEqual(["test-flow"])
      expect(result.skipped).toEqual([])
    })
  })

  describe("getManifest", () => {
    it("should export flows as manifest", async () => {
      const manifest: FlowsManifest = {
        flows: [
          {
            id: "test-flow",
            name: "Test Flow",
            trigger: { type: "manual" },
            nodes: [{ id: "n1", type: "trigger", position: { x: 0, y: 0 } }],
            edges: [],
          },
        ],
      }

      await edem.flows.applyManifest({ manifest })
      const exported = await edem.flows.getManifest()

      expect(exported.flows).toHaveLength(1)
      expect(exported.flows[0].id).toBe("test-flow")
      expect(exported.flows[0].name).toBe("Test Flow")
    })

    it("should export multiple flows", async () => {
      const manifest: FlowsManifest = {
        flows: [
          {
            id: "flow-1",
            name: "Flow 1",
            trigger: { type: "manual" },
            nodes: [],
            edges: [],
          },
          {
            id: "flow-2",
            name: "Flow 2",
            trigger: { type: "event", event: "test" },
            nodes: [],
            edges: [],
          },
        ],
      }

      await edem.flows.applyManifest({ manifest })
      const exported = await edem.flows.getManifest()

      expect(exported.flows).toHaveLength(2)
    })
  })
})
