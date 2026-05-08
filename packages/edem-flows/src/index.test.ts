import { describe, it, expect, beforeEach } from "bun:test"
import { createEdem } from "@exodus/edem-core"
import { dataModule, resetDataEngine } from "@exodus/edem-data"
import flowsModule from "./index"
import { reg } from "./test-actions"

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
        trigger: { type: "schedule", every: "1d", at: "09:00" },
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
      const { flows } = await edem.flows.listFlows({})
      expect(flows).toHaveLength(0)
    })

    it("should return all flows", async () => {
      await edem.flows.createFlow({ name: "Flow 1", trigger: { type: "manual" } })
      await edem.flows.createFlow({ name: "Flow 2", trigger: { type: "manual" } })

      const { flows } = await edem.flows.listFlows({})
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
      expect(result.status).toBe("completed")
    })

    it("should execute nodes and populate variables", async () => {
      const { flow_id } = await edem.flows.createFlow({
        name: "Node Flow",
        trigger: { type: "manual" },
        nodes: [
          { id: "start", type: "trigger", position: { x: 0, y: 0 } },
          {
            id: "transform",
            type: "transform",
            position: { x: 100, y: 0 },
            data: { field: "value", operation: "add", value: 10 },
          },
        ],
        edges: [{ id: "e1", source: "start", target: "transform" }],
      })

      const result = await edem.flows.runFlow({ flow_id, trigger_data: { value: 5 } })
      expect(result.status).toBe("completed")
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
        trigger: { type: "schedule", every: "1d", at: "09:00" },
      })

      const { flow } = await edem.flows.getFlow({ flow_id })
      expect(flow?.trigger.type).toBe("schedule")
      if (flow?.trigger.type === "schedule") {
        expect(flow.trigger.every).toBe("1d")
        expect(flow.trigger.at).toBe("09:00")
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

  describe("runFlow - last_run_at", () => {
    it("should set last_run_at when running a flow", async () => {
      const { flow_id } = await edem.flows.createFlow({
        name: "Track Run",
        trigger: { type: "manual" },
      })

      const before = Date.now()
      await edem.flows.runFlow({ flow_id })
      const after = Date.now()

      const { items } = await edem.data.queryItems({ collection_id: "flows" })
      const flow = items.find((i) => i.id === flow_id)
      expect(flow).toBeDefined()
      const lastRunAt = flow!.data.last_run_at as number
      expect(lastRunAt).toBeGreaterThanOrEqual(before)
      expect(lastRunAt).toBeLessThanOrEqual(after)
    })

    it("should update last_run_at on subsequent runs", async () => {
      const { flow_id } = await edem.flows.createFlow({
        name: "Re-run",
        trigger: { type: "manual" },
      })

      await edem.flows.runFlow({ flow_id })
      const { items: items1 } = await edem.data.queryItems({ collection_id: "flows" })
      const first = items1.find((i) => i.id === flow_id)!.data.last_run_at as number

      await new Promise((r) => setTimeout(r, 10))
      await edem.flows.runFlow({ flow_id })
      const { items: items2 } = await edem.data.queryItems({ collection_id: "flows" })
      const second = items2.find((i) => i.id === flow_id)!.data.last_run_at as number

      expect(second).toBeGreaterThan(first)
    })
  })

  describe("runFlow - runs tracking", () => {
    it("should create a run record", async () => {
      const { flow_id } = await edem.flows.createFlow({
        name: "Run Record",
        trigger: { type: "manual" },
      })

      const result = await edem.flows.runFlow({ flow_id })
      expect(result.run_id).toBeDefined()

      const { run } = await edem.flows.getRun({ run_id: result.run_id })
      expect(run).not.toBeNull()
      expect(run?.flow_id).toBe(flow_id)
      expect(run?.status).toBe("completed")
    })

    it("should store trigger_data in run", async () => {
      const { flow_id } = await edem.flows.createFlow({
        name: "Trigger Data",
        trigger: { type: "manual" },
      })

      const result = await edem.flows.runFlow({
        flow_id,
        trigger_data: { key: "value" },
      })

      const { run } = await edem.flows.getRun({ run_id: result.run_id })
      expect(run?.input).toEqual({ key: "value" })
    })

    it("should list all runs", async () => {
      const { flow_id } = await edem.flows.createFlow({
        name: "List Runs",
        trigger: { type: "manual" },
      })

      await edem.flows.runFlow({ flow_id })
      await edem.flows.runFlow({ flow_id })

      const { runs } = await edem.flows.listRuns({})
      expect(runs).toHaveLength(2)
    })

    it("should filter runs by flow_id", async () => {
      const { flow_id: f1 } = await edem.flows.createFlow({
        name: "Flow A",
        trigger: { type: "manual" },
      })
      const { flow_id: f2 } = await edem.flows.createFlow({
        name: "Flow B",
        trigger: { type: "manual" },
      })

      await edem.flows.runFlow({ flow_id: f1 })
      await edem.flows.runFlow({ flow_id: f2 })
      await edem.flows.runFlow({ flow_id: f1 })

      const { runs } = await edem.flows.listRuns({ flow_id: f1 })
      expect(runs).toHaveLength(2)
      expect(runs.every((r) => r.flow_id === f1)).toBe(true)
    })

    it("should filter runs by status", async () => {
      const { flow_id } = await edem.flows.createFlow({
        name: "Status Filter",
        trigger: { type: "manual" },
      })

      await edem.flows.runFlow({ flow_id })

      const { runs } = await edem.flows.listRuns({ status: "completed" })
      expect(runs.length).toBeGreaterThanOrEqual(1)
      expect(runs.every((r) => r.status === "completed")).toBe(true)
    })
  })

  describe("cancelRun", () => {
    it("should cancel a waiting run", async () => {
      const { flow_id } = await edem.flows.createFlow({
        name: "Cancel Test",
        trigger: { type: "manual" },
        nodes: [
          { id: "n1", type: "trigger", position: { x: 0, y: 0 } },
          {
            id: "n2",
            type: "action",
            position: { x: 100, y: 0 },
            data: { module: "test", proc: "send_email" },
          },
        ],
        edges: [{ id: "e1", source: "n1", target: "n2" }],
      })

      const result = await edem.flows.runFlow({ flow_id })
      expect(result.status).toBe("waiting")

      const cancelResult = await edem.flows.cancelRun({ run_id: result.run_id })
      expect(cancelResult.success).toBe(true)

      const { run } = await edem.flows.getRun({ run_id: result.run_id })
      expect(run?.status).toBe("cancelled")
      expect(run?.completed_at).toBeDefined()
    })

    it("should throw when cancelling non-existent run", async () => {
      await expect(edem.flows.cancelRun({ run_id: "non-existent" })).rejects.toThrow("not found")
    })

    it("should throw when cancelling completed run", async () => {
      const { flow_id } = await edem.flows.createFlow({
        name: "Completed",
        trigger: { type: "manual" },
      })

      const result = await edem.flows.runFlow({ flow_id })
      expect(result.status).toBe("completed")

      await expect(edem.flows.cancelRun({ run_id: result.run_id })).rejects.toThrow("Cannot cancel")
    })
  })

  describe("resumeRun", () => {
    it("should resume a waiting run", async () => {
      const { flow_id } = await edem.flows.createFlow({
        name: "Resume Test",
        trigger: { type: "manual" },
        nodes: [
          { id: "n1", type: "trigger", position: { x: 0, y: 0 } },
          {
            id: "n2",
            type: "action",
            position: { x: 100, y: 0 },
            data: { module: "test", proc: "resume_test_action" },
          },
          {
            id: "n3",
            type: "transform",
            position: { x: 200, y: 0 },
            data: { field: "result", operation: "set", value: "done" },
          },
        ],
        edges: [
          { id: "e1", source: "n1", target: "n2" },
          { id: "e2", source: "n2", target: "n3" },
        ],
      })

      const result = await edem.flows.runFlow({ flow_id })
      expect(result.status).toBe("waiting")

      reg("resume_test_action", async (input) => ({ approved: true, ...input }))

      const resumeResult = await edem.flows.resumeRun({ run_id: result.run_id })
      expect(resumeResult.success).toBe(true)

      const { run } = await edem.flows.getRun({ run_id: result.run_id })
      expect(run?.status).toBe("completed")
    })

    it("should throw for non-existent run", async () => {
      await expect(edem.flows.resumeRun({ run_id: "non-existent" })).rejects.toThrow("not found")
    })

    it("should throw when run is not waiting", async () => {
      const { flow_id } = await edem.flows.createFlow({
        name: "Not Waiting",
        trigger: { type: "manual" },
      })

      const result = await edem.flows.runFlow({ flow_id })

      await expect(edem.flows.resumeRun({ run_id: result.run_id })).rejects.toThrow("Cannot resume")
    })
  })

  describe("handleNodeCompleted", () => {
    it("should resume a waiting run", async () => {
      const { flow_id } = await edem.flows.createFlow({
        name: "Resume Test",
        trigger: { type: "manual" },
        nodes: [
          { id: "n1", type: "trigger", position: { x: 0, y: 0 } },
          {
            id: "n2",
            type: "action",
            position: { x: 100, y: 0 },
            data: { module: "test", proc: "approve" },
          },
          {
            id: "n3",
            type: "transform",
            position: { x: 200, y: 0 },
            data: { field: "result", operation: "set", value: "done" },
          },
        ],
        edges: [
          { id: "e1", source: "n1", target: "n2" },
          { id: "e2", source: "n2", target: "n3" },
        ],
      })

      const result = await edem.flows.runFlow({ flow_id })
      expect(result.status).toBe("waiting")

      reg("approve", async (input) => ({
        approved: true,
        ...input,
      }))

      const resumeResult = await edem.flows.handleNodeCompleted({
        run_id: result.run_id,
        node_id: "n2",
        output: { approved: true },
      })
      expect(resumeResult.success).toBe(true)

      const { run } = await edem.flows.getRun({ run_id: result.run_id })
      expect(run?.status).toBe("completed")
    })

    it("should throw for non-existent run", async () => {
      await expect(
        edem.flows.handleNodeCompleted({
          run_id: "non-existent",
          node_id: "n1",
          output: {},
        }),
      ).rejects.toThrow("not found")
    })

    it("should throw when run is not waiting", async () => {
      const { flow_id } = await edem.flows.createFlow({
        name: "Not Waiting",
        trigger: { type: "manual" },
      })

      const result = await edem.flows.runFlow({ flow_id })

      await expect(
        edem.flows.handleNodeCompleted({
          run_id: result.run_id,
          node_id: "n1",
          output: {},
        }),
      ).rejects.toThrow()
    })

    it("should throw when node_id does not match", async () => {
      const { flow_id } = await edem.flows.createFlow({
        name: "Wrong Node",
        trigger: { type: "manual" },
        nodes: [
          { id: "n1", type: "trigger", position: { x: 0, y: 0 } },
          {
            id: "n2",
            type: "action",
            position: { x: 100, y: 0 },
            data: { module: "test", proc: "wait" },
          },
        ],
        edges: [{ id: "e1", source: "n1", target: "n2" }],
      })

      const result = await edem.flows.runFlow({ flow_id })

      await expect(
        edem.flows.handleNodeCompleted({
          run_id: result.run_id,
          node_id: "wrong_node",
          output: {},
        }),
      ).rejects.toThrow("not waiting for node")
    })
  })

  describe("handleNodeFailed", () => {
    it("should fail a waiting run", async () => {
      const { flow_id } = await edem.flows.createFlow({
        name: "Fail Test",
        trigger: { type: "manual" },
        nodes: [
          { id: "n1", type: "trigger", position: { x: 0, y: 0 } },
          {
            id: "n2",
            type: "action",
            position: { x: 100, y: 0 },
            data: { module: "test", proc: "risky" },
          },
        ],
        edges: [{ id: "e1", source: "n1", target: "n2" }],
      })

      const result = await edem.flows.runFlow({ flow_id })
      expect(result.status).toBe("waiting")

      const failResult = await edem.flows.handleNodeFailed({
        run_id: result.run_id,
        node_id: "n2",
        error: "Timeout exceeded",
      })
      expect(failResult.success).toBe(true)

      const { run } = await edem.flows.getRun({ run_id: result.run_id })
      expect(run?.status).toBe("error")
      expect(run?.error).toBe("Timeout exceeded")
    })

    it("should throw for non-existent run", async () => {
      await expect(
        edem.flows.handleNodeFailed({
          run_id: "non-existent",
          node_id: "n1",
          error: "fail",
        }),
      ).rejects.toThrow("not found")
    })

    it("should throw when run is not waiting", async () => {
      const { flow_id } = await edem.flows.createFlow({
        name: "Not Waiting",
        trigger: { type: "manual" },
      })

      const result = await edem.flows.runFlow({ flow_id })

      await expect(
        edem.flows.handleNodeFailed({
          run_id: result.run_id,
          node_id: "n1",
          error: "fail",
        }),
      ).rejects.toThrow()
    })
  })

  describe("listFlows filters", () => {
    it("should filter by status", async () => {
      await edem.flows.createFlow({ name: "Draft", trigger: { type: "manual" } })
      const { flow_id } = await edem.flows.createFlow({
        name: "Active",
        trigger: { type: "manual" },
      })
      await edem.flows.updateFlow({ flow_id, name: "Active" })

      const { flows: activeFlows } = await edem.flows.listFlows({ status: "draft" })
      expect(activeFlows.every((f) => f.status === "draft")).toBe(true)
    })

    it("should filter by name substring", async () => {
      await edem.flows.createFlow({ name: "Backup Games", trigger: { type: "manual" } })
      await edem.flows.createFlow({ name: "Sync Files", trigger: { type: "manual" } })
      await edem.flows.createFlow({ name: "Backup Saves", trigger: { type: "manual" } })

      const { flows } = await edem.flows.listFlows({ name: "backup" })
      expect(flows).toHaveLength(2)
      expect(flows.every((f) => f.name.toLowerCase().includes("backup"))).toBe(true)
    })

    it("should combine status and name filters", async () => {
      await edem.flows.createFlow({ name: "Backup Games", trigger: { type: "manual" } })
      await edem.flows.createFlow({ name: "Sync Files", trigger: { type: "manual" } })

      const { flows } = await edem.flows.listFlows({ status: "draft", name: "backup" })
      expect(flows).toHaveLength(1)
      expect(flows[0].name).toBe("Backup Games")
    })
  })

  describe("backpressure", () => {
    it("should throw when maxConcurrent exceeded", async () => {
      const { flow_id } = await edem.flows.createFlow({
        name: "BP Flow",
        trigger: { type: "manual" },
        nodes: [
          { id: "n1", type: "trigger", position: { x: 0, y: 0 } },
          {
            id: "n2",
            type: "action",
            position: { x: 100, y: 0 },
            data: { module: "test", proc: "slow_action" },
          },
        ],
        edges: [{ id: "e1", source: "n1", target: "n2" }],
        backpressure: { maxConcurrent: 1 },
      })

      await edem.flows.runFlow({ flow_id })
      await expect(edem.flows.runFlow({ flow_id })).rejects.toThrow("concurrent runs")
    })

    it("should throw when maxPending exceeded", async () => {
      const { flow_id } = await edem.flows.createFlow({
        name: "BP Pending",
        trigger: { type: "manual" },
        nodes: [
          { id: "n1", type: "trigger", position: { x: 0, y: 0 } },
          {
            id: "n2",
            type: "action",
            position: { x: 100, y: 0 },
            data: { module: "test", proc: "pending_action" },
          },
        ],
        edges: [{ id: "e1", source: "n1", target: "n2" }],
        backpressure: { maxPending: 1 },
      })

      await edem.flows.runFlow({ flow_id })
      await expect(edem.flows.runFlow({ flow_id })).rejects.toThrow("waiting runs")
    })

    it("should allow runs when under limits", async () => {
      const { flow_id } = await edem.flows.createFlow({
        name: "BP OK",
        trigger: { type: "manual" },
        backpressure: { maxConcurrent: 5 },
      })

      const r1 = await edem.flows.runFlow({ flow_id })
      expect(r1.status).toBe("completed")

      const r2 = await edem.flows.runFlow({ flow_id })
      expect(r2.status).toBe("completed")
    })
  })
})
