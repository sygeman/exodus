import { describe, it, expect } from "bun:test"
import { getEdem, setupTests } from "./setup"

describe("simple run", () => {
  setupTests()
  it("run empty flow", async () => {
    const edem = getEdem()
    const { flow_id } = await edem.flows.createFlow({
      name: "Empty",
      trigger: { type: "manual" },
    })

    const result = await edem.flows.runFlow({ flow_id })
    expect(result.status).toBe("completed")
    expect(result.run_id).toBeDefined()

    const { run } = await edem.flows.getRun({ run_id: result.run_id })
    expect(run).not.toBeNull()
    expect(run?.flow_id).toBe(flow_id)
    expect(run?.status).toBe("completed")
    expect(run?.started_at).toBeGreaterThan(0)
    expect(run?.completed_at).toBeGreaterThan(0)
  })

  it("run with trigger data and node outputs", async () => {
    const edem = getEdem()
    const { flow_id } = await edem.flows.createFlow({
      name: "Node Flow",
      trigger: { type: "manual" },
      nodes: [
        { id: "start", type: "trigger", position: { x: 0, y: 0 } },
        {
          id: "calc",
          type: "transform",
          position: { x: 100, y: 0 },
          data: { field: "value", operation: "add", value: 10 },
        },
      ],
      edges: [{ id: "e1", source: "start", target: "calc" }],
    })

    const result = await edem.flows.runFlow({ flow_id, trigger_data: { value: 5 } })
    expect(result.status).toBe("completed")

    const { nodes } = await edem.flows.getRunNodes({ run_id: result.run_id })
    const calcNode = nodes.find((n) => n.node_id === "calc")
    expect(calcNode?.output).toEqual({ result: 15 })
  })

  it("last_run_at is updated", async () => {
    const edem = getEdem()
    const { flow_id } = await edem.flows.createFlow({
      name: "Track",
      trigger: { type: "manual" },
    })

    const before = Date.now()
    await edem.flows.runFlow({ flow_id })
    const after = Date.now()

    const { items } = await edem.data.queryItems({ collection_id: "flows" })
    const flow = items.find((i) => i.id === flow_id)
    const lastRunAt = flow!.data.last_run_at as number
    expect(lastRunAt).toBeGreaterThanOrEqual(before)
    expect(lastRunAt).toBeLessThanOrEqual(after)
  })

  it("run records are created", async () => {
    const edem = getEdem()
    const { flow_id } = await edem.flows.createFlow({
      name: "Run Records",
      trigger: { type: "manual" },
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
    })

    const result = await edem.flows.runFlow({ flow_id, trigger_data: { x: 0 } })

    const { runs } = await edem.flows.listRuns({})
    expect(runs.length).toBeGreaterThanOrEqual(1)

    const { nodes } = await edem.flows.getRunNodes({ run_id: result.run_id })
    const nodeIds = [...new Set(nodes.map((n) => n.node_id))]
    expect(nodeIds).toContainEqual("n1")
    expect(nodeIds).toContainEqual("n2")
    expect(nodes.every((n) => n.status === "completed")).toBe(true)
  })

  it("run filtering by flow_id and status", async () => {
    const edem = getEdem()
    const { flow_id } = await edem.flows.createFlow({
      name: "Filter",
      trigger: { type: "manual" },
    })

    await edem.flows.runFlow({ flow_id })

    const byFlow = await edem.flows.listRuns({ flow_id })
    expect(byFlow.runs.every((r) => r.flow_id === flow_id)).toBe(true)

    const byStatus = await edem.flows.listRuns({ status: "completed" })
    expect(byStatus.runs.every((r) => r.status === "completed")).toBe(true)
  })

  it("concurrent runs complete independently", async () => {
    const edem = getEdem()
    const { flow_id } = await edem.flows.createFlow({
      name: "Concurrent",
      trigger: { type: "manual" },
      nodes: [
        { id: "t", type: "trigger", position: { x: 0, y: 0 } },
        {
          id: "calc",
          type: "transform",
          position: { x: 100, y: 0 },
          data: { field: "val", operation: "set", value: "{{trigger.n}}" },
        },
      ],
      edges: [{ id: "e1", source: "t", target: "calc" }],
    })

    const results = await Promise.all([
      edem.flows.runFlow({ flow_id, trigger_data: { n: 1 } }),
      edem.flows.runFlow({ flow_id, trigger_data: { n: 2 } }),
      edem.flows.runFlow({ flow_id, trigger_data: { n: 3 } }),
    ])

    expect(results.every((r) => r.status === "completed")).toBe(true)

    const { runs } = await edem.flows.listRuns({ flow_id })
    expect(runs.length).toBeGreaterThanOrEqual(3)
    expect(runs.every((r) => r.status === "completed")).toBe(true)
  })

  it("run output contains correct node outputs", async () => {
    const edem = getEdem()
    const { flow_id } = await edem.flows.createFlow({
      name: "Output Check",
      trigger: { type: "manual" },
      nodes: [
        { id: "t", type: "trigger", position: { x: 0, y: 0 } },
        {
          id: "set",
          type: "transform",
          position: { x: 100, y: 0 },
          data: { field: "result", operation: "set", value: "final" },
        },
      ],
      edges: [{ id: "e1", source: "t", target: "set" }],
    })

    const result = await edem.flows.runFlow({ flow_id })
    const { run } = await edem.flows.getRun({ run_id: result.run_id })
    expect(run?.output?.set).toEqual({ result: "final" })
  })
})
