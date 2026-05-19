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

    it("should persist system manifest flows with null project_id", async () => {
      const manifest: FlowsManifest = {
        flows: [
          {
            id: "system-flow",
            name: "System Flow",
            trigger: { type: "manual" },
            nodes: [{ id: "n1", type: "trigger", position: { x: 0, y: 0 } }],
            edges: [],
          },
        ],
      }

      await edem.flows.applyManifest({ manifest })

      const { items } = await edem.data.queryItems({ collection_id: "flows" })
      const flow = items.find((item) => item.data.manifest_id === "system-flow")

      expect(flow?.data.project_id).toBeNull()
    })

    it("should normalize legacy manifest flows without project_id", async () => {
      const manifest: FlowsManifest = {
        flows: [
          {
            id: "legacy-system-flow",
            name: "Legacy System Flow",
            trigger: { type: "manual" },
            nodes: [{ id: "n1", type: "trigger", position: { x: 0, y: 0 } }],
            edges: [],
          },
        ],
      }

      await edem.flows.applyManifest({ manifest })

      const { items: createdItems } = await edem.data.queryItems({ collection_id: "flows" })
      const createdFlow = createdItems.find(
        (item) => item.data.manifest_id === "legacy-system-flow",
      )

      expect(createdFlow).toBeDefined()

      await edem.data.updateItem({
        item_id: createdFlow!.id,
        data: { project_id: undefined },
      })

      const result = await edem.flows.applyManifest({ manifest })
      expect(result.updated).toEqual(["legacy-system-flow"])

      const { items: updatedItems } = await edem.data.queryItems({ collection_id: "flows" })
      const updatedFlow = updatedItems.find(
        (item) => item.data.manifest_id === "legacy-system-flow",
      )

      expect(updatedFlow?.data.project_id).toBeNull()
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

    it("should delete stale flows not in manifest", async () => {
      const manifest1: FlowsManifest = {
        flows: [
          {
            id: "flow-a",
            name: "Flow A",
            trigger: { type: "manual" },
            nodes: [],
            edges: [],
          },
          {
            id: "flow-b",
            name: "Flow B",
            trigger: { type: "manual" },
            nodes: [],
            edges: [],
          },
        ],
      }

      await edem.flows.applyManifest({ manifest: manifest1 })

      const manifest2: FlowsManifest = {
        flows: [
          {
            id: "flow-a",
            name: "Flow A",
            trigger: { type: "manual" },
            nodes: [],
            edges: [],
          },
        ],
      }

      const result = await edem.flows.applyManifest({ manifest: manifest2 })
      expect(result.created).toEqual([])
      expect(result.updated).toEqual([])
      expect(result.skipped).toEqual(["flow-a"])
      expect(result.deleted).toEqual(["flow-b"])

      const exported = await edem.flows.getManifest()
      expect(exported.flows).toHaveLength(1)
      expect(exported.flows[0].id).toBe("flow-a")
    })

    it("should not delete user-created flows without manifest_id", async () => {
      const manifest: FlowsManifest = {
        flows: [
          {
            id: "manifest-flow",
            name: "Manifest Flow",
            trigger: { type: "manual" },
            nodes: [],
            edges: [],
          },
        ],
      }

      await edem.flows.applyManifest({ manifest })

      await edem.flows.createFlow({
        name: "User Flow",
        trigger: { type: "manual" },
        nodes: [],
        edges: [],
      })

      const result = await edem.flows.applyManifest({ manifest })
      expect(result.deleted).toEqual([])

      const exported = await edem.flows.getManifest()
      expect(exported.flows).toHaveLength(2)
    })

    it("should update flow when only meta changes", async () => {
      const manifest1: FlowsManifest = {
        flows: [
          {
            id: "meta-flow",
            name: "Meta Flow",
            trigger: { type: "manual" },
            nodes: [],
            edges: [],
            meta: { key: "value" },
          },
        ],
      }

      await edem.flows.applyManifest({ manifest: manifest1 })

      const manifest2: FlowsManifest = {
        flows: [
          {
            id: "meta-flow",
            name: "Meta Flow",
            trigger: { type: "manual" },
            nodes: [],
            edges: [],
            meta: { key: "updated" },
          },
        ],
      }

      const result = await edem.flows.applyManifest({ manifest: manifest2 })
      expect(result.updated).toEqual(["meta-flow"])
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
