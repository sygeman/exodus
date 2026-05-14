import { describe, it, expect } from "bun:test"
import type { FlowsManifest } from "../manifest"
import { getEdem, setupTests } from "./setup"

describe("CRUD", () => {
  setupTests()
  it("create + get + list with full fields", async () => {
    const edem = getEdem()
    const { flow_id } = await edem.flows.createFlow({
      name: "Full Flow",
      trigger: { type: "event", event: "data:item_created", filter: { collection: "tasks" } },
      nodes: [
        { id: "n1", type: "trigger", position: { x: 0, y: 0 } },
        {
          id: "n2",
          type: "transform",
          position: { x: 100, y: 0 },
          data: { field: "x", operation: "set", value: 1 },
        },
      ],
      edges: [{ id: "e1", source: "n1", target: "n2" }],
      meta: { version: 1 },
    })

    const { flow } = await edem.flows.getFlow({ flow_id })
    expect(flow).not.toBeNull()
    expect(flow?.name).toBe("Full Flow")
    expect(flow?.trigger.type).toBe("event")
    expect(flow?.nodes).toHaveLength(2)
    expect(flow?.edges).toHaveLength(1)
    expect(flow?.meta?.version).toBe(1)

    const { flows } = await edem.flows.listFlows({})
    expect(flows.length).toBeGreaterThanOrEqual(1)
    expect(flows.find((f) => f.id === flow_id)).toBeDefined()
  })

  it("update flow name, nodes, edges", async () => {
    const edem = getEdem()
    const { flow_id } = await edem.flows.createFlow({
      name: "Old Name",
      trigger: { type: "manual" },
      nodes: [{ id: "n1", type: "trigger", position: { x: 0, y: 0 } }],
    })

    await edem.flows.updateFlow({
      flow_id,
      name: "New Name",
      nodes: [
        { id: "n1", type: "trigger", position: { x: 0, y: 0 } },
        {
          id: "n2",
          type: "transform",
          position: { x: 100, y: 0 },
          data: { field: "y", operation: "set", value: 2 },
        },
      ],
      edges: [{ id: "e1", source: "n1", target: "n2" }],
    })

    const { flow } = await edem.flows.getFlow({ flow_id })
    expect(flow?.name).toBe("New Name")
    expect(flow?.nodes).toHaveLength(2)
    expect(flow?.edges).toHaveLength(1)
  })

  it("delete flow (soft delete)", async () => {
    const edem = getEdem()
    const { flow_id } = await edem.flows.createFlow({
      name: "To Delete",
      trigger: { type: "manual" },
    })

    await edem.flows.deleteFlow({ flow_id })

    const { flow } = await edem.flows.getFlow({ flow_id })
    expect(flow).toBeNull()
  })

  it("applyManifest creates/updates/skips", async () => {
    const edem = getEdem()
    const manifest: FlowsManifest = {
      flows: [
        { id: "m1", name: "Manifest Flow 1", trigger: { type: "manual" }, nodes: [], edges: [] },
        { id: "m2", name: "Manifest Flow 2", trigger: { type: "manual" }, nodes: [], edges: [] },
      ],
    }

    const r1 = await edem.flows.applyManifest({ manifest })
    expect(r1.created).toEqual(["m1", "m2"])
    expect(r1.updated).toEqual([])
    expect(r1.skipped).toEqual([])

    const r2 = await edem.flows.applyManifest({ manifest })
    expect(r2.created).toEqual([])
    expect(r2.skipped).toEqual(["m1", "m2"])

    const updated: FlowsManifest = {
      flows: [
        { id: "m1", name: "Updated M1", trigger: { type: "manual" }, nodes: [], edges: [] },
        { id: "m2", name: "Manifest Flow 2", trigger: { type: "manual" }, nodes: [], edges: [] },
      ],
    }
    const r3 = await edem.flows.applyManifest({ manifest: updated })
    expect(r3.updated).toEqual(["m1"])
    expect(r3.skipped).toEqual(["m2"])

    const exported = await edem.flows.getManifest()
    expect(exported.flows).toHaveLength(2)
    expect(exported.flows.find((f) => f.id === "m1")?.name).toBe("Updated M1")
  })

  it("applyManifest deletes stale manifest flows", async () => {
    const edem = getEdem()
    const manifest1: FlowsManifest = {
      flows: [
        { id: "s1", name: "System 1", trigger: { type: "manual" }, nodes: [], edges: [] },
        { id: "s2", name: "System 2", trigger: { type: "manual" }, nodes: [], edges: [] },
      ],
    }

    await edem.flows.applyManifest({ manifest: manifest1 })

    const manifest2: FlowsManifest = {
      flows: [{ id: "s1", name: "System 1", trigger: { type: "manual" }, nodes: [], edges: [] }],
    }

    const result = await edem.flows.applyManifest({ manifest: manifest2 })
    expect(result.deleted).toEqual(["s2"])

    const exported = await edem.flows.getManifest()
    expect(exported.flows).toHaveLength(1)
    expect(exported.flows[0].id).toBe("s1")
  })

  it("applyManifest does not delete user-created flows", async () => {
    const edem = getEdem()

    await edem.flows.createFlow({
      name: "User Flow",
      trigger: { type: "manual" },
      nodes: [],
      edges: [],
    })

    const manifest: FlowsManifest = {
      flows: [{ id: "sys1", name: "System", trigger: { type: "manual" }, nodes: [], edges: [] }],
    }

    const result = await edem.flows.applyManifest({ manifest })
    expect(result.deleted).toEqual([])

    const { flows } = await edem.flows.listFlows({})
    expect(flows).toHaveLength(2)
  })
})
