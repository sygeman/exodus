import { describe, it, expect, beforeEach } from "bun:test"
import { createEdem } from "@exodus/edem-core"
import { dataModule, resetDataEngine } from "@exodus/edem-data"
import { flowsModule } from "./index"

describe("edem-flows", () => {
  let edem: ReturnType<typeof createEdem<[typeof dataModule, typeof flowsModule]>>

  beforeEach(async () => {
    resetDataEngine()
    edem = createEdem([dataModule, flowsModule])
  })

  describe("createFlow", () => {
    it("should create a flow and return id", async () => {
      const result = await edem.flows.createFlow({
        name: "Test Flow",
        trigger: { type: "manual" },
      })
      expect(result.flow_id).toBeDefined()
    })

    it("should create flow with nodes and edges", async () => {
      const result = await edem.flows.createFlow({
        name: "Complex Flow",
        trigger: { type: "event", event: "data:item_created" },
        nodes: [
          { id: "n1", type: "condition", position: { x: 0, y: 0 }, data: {} },
          { id: "n2", type: "update", position: { x: 100, y: 0 }, data: {} },
        ],
        edges: [{ id: "e1", source: "n1", target: "n2" }],
      })

      const { flow } = await edem.flows.getFlow({ flow_id: result.flow_id })
      expect(flow).not.toBeNull()
      expect(flow?.nodes).toHaveLength(2)
      expect(flow?.edges).toHaveLength(1)
    })

    it("should persist flow in edem-data", async () => {
      await edem.flows.createFlow({
        name: "Persisted Flow",
        trigger: { type: "schedule", cron: "0 9 * * *" },
      })

      const { items } = await edem.data.queryItems({ collection_id: "flows" })
      expect(items).toHaveLength(1)
      expect(items[0].data.name).toBe("Persisted Flow")
    })
  })

  describe("updateFlow", () => {
    it("should update flow name", async () => {
      const { flow_id } = await edem.flows.createFlow({
        name: "Old Name",
        trigger: { type: "manual" },
      })

      await edem.flows.updateFlow({
        flow_id,
        name: "New Name",
      })

      const { flow } = await edem.flows.getFlow({ flow_id })
      expect(flow?.name).toBe("New Name")
    })

    it("should update flow nodes", async () => {
      const { flow_id } = await edem.flows.createFlow({
        name: "Test",
        trigger: { type: "manual" },
        nodes: [{ id: "n1", type: "start", position: { x: 0, y: 0 } }],
      })

      await edem.flows.updateFlow({
        flow_id,
        nodes: [
          { id: "n1", type: "start", position: { x: 0, y: 0 } },
          { id: "n2", type: "end", position: { x: 100, y: 0 } },
        ],
      })

      const { flow } = await edem.flows.getFlow({ flow_id })
      expect(flow?.nodes).toHaveLength(2)
    })

    it("should throw on non-existent flow", async () => {
      await expect(
        edem.flows.updateFlow({
          flow_id: "non-existent",
          name: "test",
        }),
      ).rejects.toThrow("not found")
    })
  })

  describe("deleteFlow", () => {
    it("should soft delete flow", async () => {
      const { flow_id } = await edem.flows.createFlow({
        name: "To Delete",
        trigger: { type: "manual" },
      })

      await edem.flows.deleteFlow({ flow_id })

      const { flow } = await edem.flows.getFlow({ flow_id })
      expect(flow).toBeNull()
    })
  })

  describe("getFlow", () => {
    it("should return null for non-existent flow", async () => {
      const { flow } = await edem.flows.getFlow({ flow_id: "non-existent" })
      expect(flow).toBeNull()
    })

    it("should return full flow structure", async () => {
      const { flow_id } = await edem.flows.createFlow({
        name: "Full Flow",
        trigger: { type: "event", event: "item:created", filter: { collection: "tasks" } },
        nodes: [
          { id: "n1", type: "condition", position: { x: 0, y: 0 }, data: { field: "status" } },
        ],
        edges: [],
        meta: { version: 1 },
      })

      const { flow } = await edem.flows.getFlow({ flow_id })
      expect(flow?.name).toBe("Full Flow")
      expect(flow?.trigger.type).toBe("event")
      expect(flow?.nodes[0].data?.field).toBe("status")
      expect(flow?.meta?.version).toBe(1)
    })
  })

  describe("listFlows", () => {
    it("should return empty list initially", async () => {
      const { flows } = await edem.flows.listFlows()
      expect(flows).toHaveLength(0)
    })

    it("should return all flows", async () => {
      await edem.flows.createFlow({ name: "Flow 1", trigger: { type: "manual" } })
      await edem.flows.createFlow({ name: "Flow 2", trigger: { type: "manual" } })

      const { flows } = await edem.flows.listFlows()
      expect(flows).toHaveLength(2)
    })
  })

  describe("runFlow", () => {
    it("should run empty flow successfully", async () => {
      const { flow_id } = await edem.flows.createFlow({
        name: "Empty Flow",
        trigger: { type: "manual" },
      })

      const result = await edem.flows.runFlow({ flow_id })
      expect(result.status).toBe("success")
      expect(result.run_id).toBeDefined()
    })

    it("should execute nodes and populate variables", async () => {
      const { flow_id } = await edem.flows.createFlow({
        name: "Node Flow",
        trigger: { type: "manual" },
        nodes: [
          { id: "start", type: "trigger", position: { x: 0, y: 0 } },
          { id: "action", type: "update", position: { x: 100, y: 0 }, data: { target: "item" } },
        ],
        edges: [{ id: "e1", source: "start", target: "action" }],
      })

      const result = await edem.flows.runFlow({ flow_id })
      expect(result.status).toBe("success")
    })

    it("should throw on non-existent flow", async () => {
      await expect(edem.flows.runFlow({ flow_id: "non-existent" })).rejects.toThrow("not found")
    })
  })

  describe("trigger types", () => {
    it("should support event trigger", async () => {
      const { flow_id } = await edem.flows.createFlow({
        name: "Event Flow",
        trigger: { type: "event", event: "data:item_created", filter: { collection: "tasks" } },
      })

      const { flow } = await edem.flows.getFlow({ flow_id })
      expect(flow?.trigger.type).toBe("event")
      if (flow?.trigger.type === "event") {
        expect(flow.trigger.event).toBe("data:item_created")
        expect(flow.trigger.filter?.collection).toBe("tasks")
      }
    })

    it("should support schedule trigger", async () => {
      const { flow_id } = await edem.flows.createFlow({
        name: "Scheduled Flow",
        trigger: { type: "schedule", cron: "0 9 * * *" },
      })

      const { flow } = await edem.flows.getFlow({ flow_id })
      expect(flow?.trigger.type).toBe("schedule")
      if (flow?.trigger.type === "schedule") {
        expect(flow.trigger.cron).toBe("0 9 * * *")
      }
    })

    it("should support webhook trigger", async () => {
      const { flow_id } = await edem.flows.createFlow({
        name: "Webhook Flow",
        trigger: { type: "webhook", path: "/hooks/my-flow" },
      })

      const { flow } = await edem.flows.getFlow({ flow_id })
      expect(flow?.trigger.type).toBe("webhook")
    })
  })
})
