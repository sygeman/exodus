import { describe, it, expect, beforeEach } from "bun:test"
import { createEdem, awaitEdemInit } from "@exodus/edem-core"
import { dataModule, resetDataEngine } from "@exodus/edem-data"
import flowsModule from "./index"
import { reg, testModule } from "./test-actions"
import { callNode } from "./test-flow"

describe("edem-flows", () => {
  let edem: ReturnType<
    typeof createEdem<[typeof dataModule, typeof flowsModule, typeof testModule]>
  >

  beforeEach(async () => {
    resetDataEngine()
    edem = createEdem([dataModule, flowsModule, testModule])
    await awaitEdemInit(edem)
  })

  describe("createFlow", () => {
    it("should create a flow and return id", async () => {
      const result = await edem.flows.createFlow({
        name: "Test Flow",
        trigger: { type: "manual" },
      })
      expect(result.flow_id).toBeDefined()

      const { flow } = await edem.flows.getFlow({ flow_id: result.flow_id })
      expect(flow?.kind).toBe("flow")
      expect(flow?.valid).toBe(true)
      expect(flow?.nodes).toHaveLength(1)
      expect(flow?.nodes[0]?.type).toBe("trigger")
      expect(flow?.nodes[0]?.data?.source).toEqual({ type: "manual" })
    })

    it("should create flow with nodes and edges", async () => {
      const result = await edem.flows.createFlow({
        name: "Complex Flow",
        trigger: { type: "event", event: "data.itemCreated" },
        nodes: [
          { id: "n1", type: "trigger", position: { x: 0, y: 0 } },
          { id: "n2", type: "update", position: { x: 100, y: 0 }, data: {} },
        ],
        edges: [{ id: "e1", source: "n1", target: "n2" }],
      })

      const { flow } = await edem.flows.getFlow({ flow_id: result.flow_id })
      expect(flow).not.toBeNull()
      expect(flow?.nodes).toHaveLength(2)
      expect(flow?.edges).toHaveLength(1)
      expect(flow?.valid).toBe(true)
    })

    it("should create default subflow skeleton", async () => {
      const result = await edem.flows.createFlow({
        name: "Subflow",
        kind: "subflow",
      })

      const { flow } = await edem.flows.getFlow({ flow_id: result.flow_id })
      expect(flow?.kind).toBe("subflow")
      expect(flow?.trigger).toBeUndefined()
      expect(flow?.nodes.map((node) => node.type)).toEqual(["input", "output"])
      expect(flow?.edges).toEqual([{ id: "input-output", source: "input", target: "output" }])
      expect(flow?.valid).toBe(true)
      expect(flow?.validation_errors).toEqual([])
    })

    it("should persist flow in edem-data", async () => {
      await edem.flows.createFlow({
        name: "Persisted Flow",
        trigger: { type: "schedule", every: "1d", at: "09:00" },
      })

      const { items } = await edem.data.queryItems({ collection_id: "flows" })
      expect(items).toHaveLength(1)
      expect(items[0].data.name).toBe("Persisted Flow")
      expect(items[0].data.trigger).toBeUndefined()
    })

    it("should accept direct procedure node types for query and mutation procedures", async () => {
      const result = await edem.flows.createFlow({
        name: "Procedure Node",
        trigger: { type: "manual" },
        nodes: [
          { id: "trigger", type: "trigger", position: { x: 0, y: 0 } },
          callNode({ id: "list", module: "data", procedure: "listCollections" }),
        ],
        edges: [{ id: "e1", source: "trigger", target: "list" }],
      })

      const { flow } = await edem.flows.getFlow({ flow_id: result.flow_id })
      expect(flow?.valid).toBe(true)
      expect(flow?.validation_errors).toEqual([])
    })

    it("should mark flow invalid when call node references a subscription", async () => {
      const result = await edem.flows.createFlow({
        name: "Bad Procedure Node",
        trigger: { type: "manual" },
        nodes: [
          { id: "trigger", type: "trigger", position: { x: 0, y: 0 } },
          callNode({ id: "event", module: "data", procedure: "itemCreated" }),
        ],
        edges: [{ id: "e1", source: "trigger", target: "event" }],
      })

      const { flow } = await edem.flows.getFlow({ flow_id: result.flow_id })
      expect(flow?.valid).toBe(false)
      expect(flow?.validation_errors).toContain(
        'Node "event" references subscription "data.itemCreated"; use query or mutation',
      )
    })

    it("should mark flow invalid when call node references an unknown procedure", async () => {
      const result = await edem.flows.createFlow({
        name: "Unknown Procedure Node",
        trigger: { type: "manual" },
        nodes: [
          { id: "trigger", type: "trigger", position: { x: 0, y: 0 } },
          callNode({ id: "missing", module: "data", procedure: "missingProcedure" }),
        ],
        edges: [{ id: "e1", source: "trigger", target: "missing" }],
      })

      const { flow } = await edem.flows.getFlow({ flow_id: result.flow_id })
      expect(flow?.valid).toBe(false)
      expect(flow?.validation_errors).toContain(
        'Node "missing" references unknown procedure "data.missingProcedure"',
      )
    })

    it("should mark flow invalid when schedule trigger config is malformed", async () => {
      const result = await edem.flows.createFlow({
        name: "Bad Schedule Trigger",
        trigger: { type: "schedule", every: "daily", at: "25:00" },
      })

      const { flow } = await edem.flows.getFlow({ flow_id: result.flow_id })
      expect(flow?.valid).toBe(false)
      expect(flow?.validation_errors).toContain('Schedule trigger has invalid every value "daily"')
      expect(flow?.validation_errors).toContain('Schedule trigger has invalid at value "25:00"')
    })

    it("should mark flow invalid when event trigger source is empty", async () => {
      const result = await edem.flows.createFlow({
        name: "Bad Event Trigger",
        trigger: { type: "event", event: "" },
      })

      const { flow } = await edem.flows.getFlow({ flow_id: result.flow_id })
      expect(flow?.valid).toBe(false)
      expect(flow?.validation_errors).toContain("Trigger event source must not be empty")
    })

    it("should mark flow invalid when dotted event source references a non-subscription", async () => {
      const result = await edem.flows.createFlow({
        name: "Bad Subscription Trigger",
        trigger: { type: "event", event: "data.listCollections" },
      })

      const { flow } = await edem.flows.getFlow({ flow_id: result.flow_id })
      expect(flow?.valid).toBe(false)
      expect(flow?.validation_errors).toContain(
        'Trigger event source "data.listCollections" must reference a subscription',
      )
    })

    it("should keep canonical call nodes", async () => {
      const result = await edem.flows.createFlow({
        name: "Legacy Procedure Action",
        trigger: { type: "manual" },
        nodes: [
          { id: "trigger", type: "trigger", position: { x: 0, y: 0 } },
          callNode({
            id: "call",
            module: "data",
            procedure: "listCollections",
            position: { x: 120, y: 0 },
          }),
        ],
        edges: [{ id: "e1", source: "trigger", target: "call" }],
      })

      const { flow } = await edem.flows.getFlow({ flow_id: result.flow_id })
      expect(flow?.nodes.find((node) => node.id === "call")?.type).toBe("call")
      expect(flow?.nodes.find((node) => node.id === "call")?.data?.procedure).toBe(
        "listCollections",
      )
    })

    it("should mark flow invalid when call references a subscription", async () => {
      const result = await edem.flows.createFlow({
        name: "Legacy Subscription Action",
        trigger: { type: "manual" },
        nodes: [
          { id: "trigger", type: "trigger", position: { x: 0, y: 0 } },
          callNode({
            id: "legacy",
            module: "data",
            procedure: "itemCreated",
            position: { x: 120, y: 0 },
          }),
        ],
        edges: [{ id: "e1", source: "trigger", target: "legacy" }],
      })

      const { flow } = await edem.flows.getFlow({ flow_id: result.flow_id })
      expect(flow?.valid).toBe(false)
      expect(flow?.validation_errors).toContain(
        'Node "legacy" references subscription "data.itemCreated"; use query or mutation',
      )
    })

    it("should mark flow invalid when call references an unknown procedure", async () => {
      const result = await edem.flows.createFlow({
        name: "Legacy Unknown Action",
        trigger: { type: "manual" },
        nodes: [
          { id: "trigger", type: "trigger", position: { x: 0, y: 0 } },
          callNode({
            id: "legacy",
            module: "data",
            procedure: "missingProcedure",
            position: { x: 120, y: 0 },
          }),
        ],
        edges: [{ id: "e1", source: "trigger", target: "legacy" }],
      })

      const { flow } = await edem.flows.getFlow({ flow_id: result.flow_id })
      expect(flow?.valid).toBe(false)
      expect(flow?.validation_errors).toContain(
        'Node "legacy" references unknown procedure "data.missingProcedure"',
      )
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
          { id: "n1", type: "trigger", position: { x: 0, y: 0 } },
          { id: "n2", type: "end", position: { x: 100, y: 0 } },
        ],
      })

      const { flow } = await edem.flows.getFlow({ flow_id })
      expect(flow?.nodes).toHaveLength(2)
    })

    it("should reset schema when kind changes", async () => {
      const { flow_id } = await edem.flows.createFlow({
        name: "Convertible",
        trigger: { type: "manual" },
        nodes: [
          { id: "trigger", type: "trigger", position: { x: 0, y: 0 } },
          { id: "n2", type: "transform", position: { x: 120, y: 0 } },
        ],
        edges: [{ id: "e1", source: "trigger", target: "n2" }],
      })

      await edem.flows.updateFlow({
        flow_id,
        kind: "subflow",
      })

      const { flow } = await edem.flows.getFlow({ flow_id })
      expect(flow?.kind).toBe("subflow")
      expect(flow?.trigger).toBeUndefined()
      expect(flow?.nodes.map((node) => node.id)).toEqual(["input", "output"])
      expect(flow?.edges).toEqual([{ id: "input-output", source: "input", target: "output" }])
      expect(flow?.valid).toBe(true)
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
        trigger: { type: "event", event: "data.itemCreated", filter: { collection_id: "tasks" } },
        nodes: [
          { id: "n1", type: "condition", position: { x: 0, y: 0 }, data: { field: "status" } },
        ],
        edges: [],
        meta: { version: 1 },
      })

      const { flow } = await edem.flows.getFlow({ flow_id })
      expect(flow?.name).toBe("Full Flow")
      expect(flow?.trigger?.type).toBe("event")
      expect(flow?.nodes.some((node) => node.type === "trigger")).toBe(true)
      expect(flow?.nodes.find((node) => node.id === "n1")?.data?.field).toBe("status")
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

  describe("getProcedureCatalog", () => {
    it("should expose serializable procedure metadata for editor usage", async () => {
      const { modules } = await edem.flows.getProcedureCatalog()

      const dataProcedures = modules.find((entry) => entry.module === "data")?.procedures ?? []
      const flowsProcedures = modules.find((entry) => entry.module === "flows")?.procedures ?? []

      expect(dataProcedures.find((entry) => entry.name === "listCollections")).toMatchObject({
        name: "listCollections",
        kind: "query",
        inputSchema: {
          mode: "json-schema",
          schema: expect.objectContaining({
            type: "object",
            properties: expect.objectContaining({
              parent_id: expect.objectContaining({ type: "string" }),
            }),
          }),
        },
        outputSchema: {
          mode: "json-schema",
          schema: expect.objectContaining({ type: "object" }),
        },
      })
      expect(dataProcedures.find((entry) => entry.name === "itemCreated")).toMatchObject({
        name: "itemCreated",
        kind: "subscription",
        inputSchema: { mode: "none" },
        outputSchema: {
          mode: "json-schema",
          schema: expect.objectContaining({ type: "object" }),
        },
      })
      expect(flowsProcedures.find((entry) => entry.name === "runFlow")).toMatchObject({
        name: "runFlow",
        kind: "mutation",
        inputSchema: {
          mode: "json-schema",
          schema: expect.objectContaining({
            type: "object",
            properties: expect.objectContaining({
              flow_id: expect.objectContaining({ type: "string" }),
            }),
          }),
        },
        outputSchema: {
          mode: "json-schema",
          schema: expect.objectContaining({ type: "object" }),
        },
      })
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

    it("should execute call nodes backed by procedures", async () => {
      const { flow_id } = await edem.flows.createFlow({
        name: "Direct Procedure Run",
        trigger: { type: "manual" },
        nodes: [
          { id: "trigger", type: "trigger", position: { x: 0, y: 0 } },
          callNode({ id: "list", module: "data", procedure: "listCollections" }),
        ],
        edges: [{ id: "e1", source: "trigger", target: "list" }],
      })

      const result = await edem.flows.runFlow({ flow_id })
      expect(result.status).toBe("completed")

      const { run } = await edem.flows.getRun({ run_id: result.run_id })
      const listOutput = run?.output?.list as { collections?: Array<{ id: string }> } | undefined
      expect(Array.isArray(listOutput?.collections)).toBe(true)
      expect(listOutput?.collections?.some((collection) => collection.id === "flows")).toBe(true)
    })

    it("should reject running flow with invalid call nodes", async () => {
      const { flow_id } = await edem.flows.createFlow({
        name: "Invalid Direct Procedure Run",
        trigger: { type: "manual" },
        nodes: [
          { id: "trigger", type: "trigger", position: { x: 0, y: 0 } },
          callNode({ id: "event", module: "data", procedure: "itemCreated" }),
        ],
        edges: [{ id: "e1", source: "trigger", target: "event" }],
      })

      await expect(edem.flows.runFlow({ flow_id })).rejects.toThrow(
        'Node "event" references subscription "data.itemCreated"; use query or mutation',
      )
    })
  })

  describe("trigger types", () => {
    it("should support event trigger", async () => {
      const { flow_id } = await edem.flows.createFlow({
        name: "Event Flow",
        trigger: { type: "event", event: "data.itemCreated", filter: { collection_id: "tasks" } },
      })

      const { flow } = await edem.flows.getFlow({ flow_id })
      expect(flow?.trigger?.type).toBe("event")
      if (flow?.trigger?.type === "event") {
        expect(flow.trigger.event).toBe("data.itemCreated")
        expect(flow.trigger.filter?.collection_id).toBe("tasks")
      }
    })

    it("should support schedule trigger", async () => {
      const { flow_id } = await edem.flows.createFlow({
        name: "Scheduled Flow",
        trigger: { type: "schedule", every: "1d", at: "09:00" },
      })

      const { flow } = await edem.flows.getFlow({ flow_id })
      expect(flow?.trigger?.type).toBe("schedule")
      if (flow?.trigger?.type === "schedule") {
        expect(flow.trigger.every).toBe("1d")
        expect(flow.trigger.at).toBe("09:00")
      }
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
      reg("send_email", async () => ({ status: "pending" }))

      const { flow_id } = await edem.flows.createFlow({
        name: "Cancel Test",
        trigger: { type: "manual" },
        nodes: [
          { id: "n1", type: "trigger", position: { x: 0, y: 0 } },
          callNode({ id: "n2", module: "test", procedure: "send_email" }),
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
      reg("resume_test_action", async () => ({ status: "pending" }))

      const { flow_id } = await edem.flows.createFlow({
        name: "Resume Test",
        trigger: { type: "manual" },
        nodes: [
          { id: "n1", type: "trigger", position: { x: 0, y: 0 } },
          callNode({ id: "n2", module: "test", procedure: "resume_test_action" }),
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
      reg("approve", async () => ({ status: "pending" }))

      const { flow_id } = await edem.flows.createFlow({
        name: "Resume Test",
        trigger: { type: "manual" },
        nodes: [
          { id: "n1", type: "trigger", position: { x: 0, y: 0 } },
          callNode({ id: "n2", module: "test", procedure: "approve" }),
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
      reg("wait", async () => ({ status: "pending" }))

      const { flow_id } = await edem.flows.createFlow({
        name: "Wrong Node",
        trigger: { type: "manual" },
        nodes: [
          { id: "n1", type: "trigger", position: { x: 0, y: 0 } },
          callNode({ id: "n2", module: "test", procedure: "wait" }),
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
      reg("risky", async () => ({ status: "pending" }))

      const { flow_id } = await edem.flows.createFlow({
        name: "Fail Test",
        trigger: { type: "manual" },
        nodes: [
          { id: "n1", type: "trigger", position: { x: 0, y: 0 } },
          callNode({ id: "n2", module: "test", procedure: "risky" }),
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
      reg("slow_action", async () => ({ status: "pending" }))

      const { flow_id } = await edem.flows.createFlow({
        name: "BP Flow",
        trigger: { type: "manual" },
        nodes: [
          { id: "n1", type: "trigger", position: { x: 0, y: 0 } },
          callNode({ id: "n2", module: "test", procedure: "slow_action" }),
        ],
        edges: [{ id: "e1", source: "n1", target: "n2" }],
        backpressure: { maxConcurrent: 1 },
      })

      await edem.flows.runFlow({ flow_id })
      await expect(edem.flows.runFlow({ flow_id })).rejects.toThrow("concurrent runs")
    })

    it("should throw when maxPending exceeded", async () => {
      reg("pending_action", async () => ({ status: "pending" }))

      const { flow_id } = await edem.flows.createFlow({
        name: "BP Pending",
        trigger: { type: "manual" },
        nodes: [
          { id: "n1", type: "trigger", position: { x: 0, y: 0 } },
          callNode({ id: "n2", module: "test", procedure: "pending_action" }),
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
