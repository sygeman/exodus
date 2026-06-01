import { describe, it, expect, beforeEach } from "bun:test"
import { createEdem, awaitEdemInit } from "@exodus/edem-core"
import { dataModule, resetDataEngine } from "@exodus/edem-data"
import { flowsModule } from "./index"
import type { FlowsManifest } from "./manifest"
import { canonicalFlowShape, canonicalManifestFlow } from "./test-flow"

describe("flows manifest", () => {
  let edem: ReturnType<typeof createEdem<[typeof dataModule, typeof flowsModule]>>

  beforeEach(async () => {
    resetDataEngine()
    edem = createEdem([dataModule, flowsModule])
    await awaitEdemInit(edem)
  })

  describe("applyManifest", () => {
    it("should create flows from manifest", async () => {
      const manifest: FlowsManifest = {
        flows: [
          canonicalManifestFlow({
            id: "test-flow-1",
            name: "Test Flow 1",
            trigger: { type: "manual" },
            nodes: [{ id: "n1", type: "trigger", position: { x: 0, y: 0 } }],
            edges: [],
          }),
          canonicalManifestFlow({
            id: "test-flow-2",
            name: "Test Flow 2",
            trigger: { type: "event", event: "test:event" },
            nodes: [{ id: "n1", type: "trigger", position: { x: 0, y: 0 } }],
            edges: [],
          }),
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
          canonicalManifestFlow({
            id: "test-flow",
            name: "Test Flow",
            trigger: { type: "manual" },
            nodes: [{ id: "n1", type: "trigger", position: { x: 0, y: 0 } }],
            edges: [],
          }),
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
          canonicalManifestFlow({
            id: "system-flow",
            name: "System Flow",
            trigger: { type: "manual" },
            nodes: [{ id: "n1", type: "trigger", position: { x: 0, y: 0 } }],
            edges: [],
          }),
        ],
      }

      await edem.flows.applyManifest({ manifest })

      const { items } = await edem.data.queryItems({ collection_id: "flows" })
      const flow = items.find((item) => item.data.manifest_id === "system-flow")

      expect(flow?.data.project_id).toBeNull()
    })

    it("should update changed flows", async () => {
      const manifest: FlowsManifest = {
        flows: [
          canonicalManifestFlow({
            id: "test-flow",
            name: "Test Flow",
            trigger: { type: "manual" },
            nodes: [{ id: "n1", type: "trigger", position: { x: 0, y: 0 } }],
            edges: [],
          }),
        ],
      }

      await edem.flows.applyManifest({ manifest })

      const updatedManifest: FlowsManifest = {
        flows: [
          canonicalManifestFlow({
            id: "test-flow",
            name: "Updated Flow",
            trigger: { type: "manual" },
            nodes: [
              { id: "n1", type: "trigger", position: { x: 0, y: 0 } },
              { id: "n2", type: "transform", position: { x: 100, y: 0 } },
            ],
            edges: [{ id: "e1", source: "n1", target: "n2" }],
          }),
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
          canonicalManifestFlow({
            id: "flow-a",
            name: "Flow A",
            trigger: { type: "manual" },
            nodes: [],
            edges: [],
          }),
          canonicalManifestFlow({
            id: "flow-b",
            name: "Flow B",
            trigger: { type: "manual" },
            nodes: [],
            edges: [],
          }),
        ],
      }

      await edem.flows.applyManifest({ manifest: manifest1 })

      const manifest2: FlowsManifest = {
        flows: [
          canonicalManifestFlow({
            id: "flow-a",
            name: "Flow A",
            trigger: { type: "manual" },
            nodes: [],
            edges: [],
          }),
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
          canonicalManifestFlow({
            id: "manifest-flow",
            name: "Manifest Flow",
            trigger: { type: "manual" },
            nodes: [],
            edges: [],
          }),
        ],
      }

      await edem.flows.applyManifest({ manifest })

      await edem.flows.createFlow({
        name: "User Flow",
        ...canonicalFlowShape({ trigger: { type: "manual" }, nodes: [], edges: [] }),
      })

      const result = await edem.flows.applyManifest({ manifest })
      expect(result.deleted).toEqual([])

      const exported = await edem.flows.getManifest()
      expect(exported.flows).toHaveLength(2)
    })

    it("should update flow when only meta changes", async () => {
      const manifest1: FlowsManifest = {
        flows: [
          canonicalManifestFlow({
            id: "meta-flow",
            name: "Meta Flow",
            trigger: { type: "manual" },
            nodes: [],
            edges: [],
            meta: { key: "value" },
          }),
        ],
      }

      await edem.flows.applyManifest({ manifest: manifest1 })

      const manifest2: FlowsManifest = {
        flows: [
          canonicalManifestFlow({
            id: "meta-flow",
            name: "Meta Flow",
            trigger: { type: "manual" },
            nodes: [],
            edges: [],
            meta: { key: "updated" },
          }),
        ],
      }

      const result = await edem.flows.applyManifest({ manifest: manifest2 })
      expect(result.updated).toEqual(["meta-flow"])
    })

    it("should derive trigger from trigger node source when top-level trigger is omitted", async () => {
      const manifest: FlowsManifest = {
        flows: [
          {
            id: "node-source-flow",
            name: "Node Source Flow",
            nodes: [
              {
                id: "trigger",
                type: "trigger",
                position: { x: 0, y: 0 },
                data: { source: { type: "event", event: "data.itemCreated" } },
              },
            ],
            edges: [],
          },
        ],
      }

      await edem.flows.applyManifest({ manifest })

      const exported = await edem.flows.getManifest()
      expect(exported.flows[0]?.nodes[0]?.data?.source).toEqual({
        type: "event",
        event: "data.itemCreated",
      })

      const { flows } = await edem.flows.listFlows({})
      expect(flows[0]?.nodes[0]?.data?.source).toEqual({
        type: "event",
        event: "data.itemCreated",
      })

      const { items } = await edem.data.queryItems({ collection_id: "flows" })
      expect(items[0]?.data.trigger).toBeUndefined()
    })
  })

  describe("getManifest", () => {
    it("should export flows as manifest", async () => {
      const manifest: FlowsManifest = {
        flows: [
          canonicalManifestFlow({
            id: "test-flow",
            name: "Test Flow",
            trigger: { type: "manual" },
            nodes: [{ id: "n1", type: "trigger", position: { x: 0, y: 0 } }],
            edges: [],
          }),
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
          canonicalManifestFlow({
            id: "flow-1",
            name: "Flow 1",
            trigger: { type: "manual" },
            nodes: [],
            edges: [],
          }),
          canonicalManifestFlow({
            id: "flow-2",
            name: "Flow 2",
            trigger: { type: "event", event: "test" },
            nodes: [],
            edges: [],
          }),
        ],
      }

      await edem.flows.applyManifest({ manifest })
      const exported = await edem.flows.getManifest()

      expect(exported.flows).toHaveLength(2)
    })
  })
})
