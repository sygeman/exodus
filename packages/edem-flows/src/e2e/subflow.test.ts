import { describe, it, expect } from "bun:test"
import { reg } from "../test-actions"
import { callNode } from "../test-flow"
import { getEdem, setupTests } from "./setup"

describe("subflow", () => {
  setupTests()
  it("subflow completes and injects output", async () => {
    const edem = getEdem()
    const { flow_id: childId } = await edem.flows.createFlow({
      name: "Child",
      kind: "subflow",
      nodes: [
        { id: "c_in", type: "input", position: { x: 0, y: 0 } },
        {
          id: "c_calc",
          type: "transform",
          position: { x: 100, y: 0 },
          data: { field: "child_val", operation: "set", value: 42 },
        },
        {
          id: "c_out",
          type: "output",
          position: { x: 200, y: 0 },
          data: { outputs: { childResult: "{{nodes.c_calc.output.child_val}}" } },
        },
      ],
      edges: [
        { id: "ce1", source: "c_in", target: "c_calc" },
        { id: "ce2", source: "c_calc", target: "c_out" },
      ],
    })

    const { flow_id: parentId } = await edem.flows.createFlow({
      name: "Parent",
      trigger: { type: "manual" },
      nodes: [
        { id: "p_t", type: "trigger", position: { x: 0, y: 0 } },
        { id: "p_sub", type: "subflow", position: { x: 100, y: 0 }, data: { flow_id: childId } },
        {
          id: "p_done",
          type: "transform",
          position: { x: 200, y: 0 },
          data: { field: "done", operation: "set", value: true },
        },
      ],
      edges: [
        { id: "pe1", source: "p_t", target: "p_sub" },
        { id: "pe2", source: "p_sub", target: "p_done" },
      ],
    })

    const result = await edem.flows.runFlow({ flow_id: parentId, trigger_data: {} })
    expect(result.status).toBe("completed")

    const { run } = await edem.flows.getRun({ run_id: result.run_id })
    expect(run?.flow_id).toBe(parentId)
  })

  it("subflow parent_run_id linking", async () => {
    const edem = getEdem()
    const { flow_id: childId } = await edem.flows.createFlow({
      name: "Child Link",
      kind: "subflow",
      nodes: [
        { id: "c_in", type: "input", position: { x: 0, y: 0 } },
        { id: "c_out", type: "output", position: { x: 200, y: 0 }, data: { outputs: {} } },
      ],
      edges: [{ id: "ce1", source: "c_in", target: "c_out" }],
    })

    const { flow_id: parentId } = await edem.flows.createFlow({
      name: "Parent Link",
      trigger: { type: "manual" },
      nodes: [
        { id: "p_t", type: "trigger", position: { x: 0, y: 0 } },
        { id: "p_sub", type: "subflow", position: { x: 100, y: 0 }, data: { flow_id: childId } },
      ],
      edges: [{ id: "pe1", source: "p_t", target: "p_sub" }],
    })

    const parentResult = await edem.flows.runFlow({ flow_id: parentId })
    const { runs } = await edem.flows.listRuns({})
    const childRun = runs.find((r) => r.flow_id === childId)
    expect(childRun).toBeDefined()
    expect(childRun?.parent_run_id).toBe(parentResult.run_id)
  })

  it("subflow error propagates to parent", async () => {
    const edem = getEdem()
    const { flow_id: childId } = await edem.flows.createFlow({
      name: "Failing Child",
      kind: "subflow",
      nodes: [
        { id: "c_in", type: "input", position: { x: 0, y: 0 } },
        { id: "c_bad", type: "nonexistent_type_xyz", position: { x: 100, y: 0 } },
        { id: "c_out", type: "output", position: { x: 200, y: 0 }, data: { outputs: {} } },
      ],
      edges: [
        { id: "ce1", source: "c_in", target: "c_bad" },
        { id: "ce2", source: "c_bad", target: "c_out" },
      ],
    })

    const { flow_id: parentId } = await edem.flows.createFlow({
      name: "Parent of Failing",
      trigger: { type: "manual" },
      nodes: [
        { id: "p_t", type: "trigger", position: { x: 0, y: 0 } },
        { id: "p_sub", type: "subflow", position: { x: 100, y: 0 }, data: { flow_id: childId } },
      ],
      edges: [{ id: "pe1", source: "p_t", target: "p_sub" }],
    })

    const result = await edem.flows.runFlow({ flow_id: parentId })
    expect(result.status).toBe("error")

    const { run } = await edem.flows.getRun({ run_id: result.run_id })
    expect(run?.error).toContain("Subflow failed")
    expect(run?.waiting_node_id).toBeNull()
    expect(run?.output).toBeDefined()
  })

  it("invalid child subflow fails parent and emits runCompleted", async () => {
    const edem = getEdem()
    const completedRunIds: string[] = []

    edem.flows.runCompleted((event) => {
      completedRunIds.push(event.event.id)
    })

    const { flow_id: childId } = await edem.flows.createFlow({
      name: "Invalid Child",
      kind: "subflow",
      nodes: [{ id: "c_in", type: "input", position: { x: 0, y: 0 } }],
      edges: [],
    })

    const { flow_id: parentId } = await edem.flows.createFlow({
      name: "Parent of Invalid Child",
      trigger: { type: "manual" },
      nodes: [
        { id: "p_t", type: "trigger", position: { x: 0, y: 0 } },
        { id: "p_sub", type: "subflow", position: { x: 100, y: 0 }, data: { flow_id: childId } },
      ],
      edges: [{ id: "pe1", source: "p_t", target: "p_sub" }],
    })

    const result = await edem.flows.runFlow({ flow_id: parentId })
    expect(result.status).toBe("error")
    expect(completedRunIds).toContain(result.run_id)

    const { run } = await edem.flows.getRun({ run_id: result.run_id })
    expect(run?.error).toContain("Invalid subflow")

    const { runs } = await edem.flows.listRuns({})
    expect(runs.filter((entry) => entry.flow_id === childId)).toHaveLength(0)
  })

  it("subflow with async child (waiting) resumes parent after handleNodeCompleted on both", async () => {
    const edem = getEdem()
    reg("e2e_subflow_async_action", async () => ({ status: "pending" }))
    const { flow_id: childId } = await edem.flows.createFlow({
      name: "Async Child",
      kind: "subflow",
      nodes: [
        { id: "c_in", type: "input", position: { x: 0, y: 0 } },
        callNode({ id: "c_wait", module: "test", procedure: "e2e_subflow_async_action" }),
        {
          id: "c_out",
          type: "output",
          position: { x: 200, y: 0 },
          data: { outputs: { childDone: true } },
        },
      ],
      edges: [
        { id: "ce1", source: "c_in", target: "c_wait" },
        { id: "ce2", source: "c_wait", target: "c_out" },
      ],
    })

    const { flow_id: parentId } = await edem.flows.createFlow({
      name: "Parent of Async",
      trigger: { type: "manual" },
      nodes: [
        { id: "p_t", type: "trigger", position: { x: 0, y: 0 } },
        { id: "p_sub", type: "subflow", position: { x: 100, y: 0 }, data: { flow_id: childId } },
        {
          id: "p_after",
          type: "transform",
          position: { x: 200, y: 0 },
          data: { field: "result", operation: "set", value: "done" },
        },
      ],
      edges: [
        { id: "pe1", source: "p_t", target: "p_sub" },
        { id: "pe2", source: "p_sub", target: "p_after" },
      ],
    })

    const result = await edem.flows.runFlow({ flow_id: parentId })
    expect(result.status).toBe("waiting")

    const { run: parentWaiting } = await edem.flows.getRun({ run_id: result.run_id })
    expect(parentWaiting?.status).toBe("waiting")

    reg("e2e_subflow_async_action", async (input) => ({ confirmed: true, ...input }))

    const { runs } = await edem.flows.listRuns({})
    const childRun = runs.find((r) => r.flow_id === childId)
    expect(childRun).toBeDefined()
    expect(childRun?.status).toBe("waiting")

    await edem.flows.handleNodeCompleted({
      run_id: childRun!.id,
      node_id: "c_wait",
      output: { confirmed: true },
    })

    const { run: childDone } = await edem.flows.getRun({ run_id: childRun!.id })
    expect(childDone?.status).toBe("completed")

    const childOutput = childDone?.output ?? {}
    await edem.flows.handleNodeCompleted({
      run_id: result.run_id,
      node_id: "p_sub",
      output: { status: "completed", child_output: childOutput },
    })

    const { run: parentFinal } = await edem.flows.getRun({ run_id: result.run_id })
    expect(parentFinal?.status).toBe("completed")
    expect(parentFinal?.waiting_node_id).toBeNull()
  })

  it("multiple parent runs share the same child flow definition", async () => {
    const edem = getEdem()
    const { flow_id: childId } = await edem.flows.createFlow({
      name: "Shared Child",
      kind: "subflow",
      nodes: [
        { id: "c_in", type: "input", position: { x: 0, y: 0 } },
        {
          id: "c_val",
          type: "transform",
          position: { x: 100, y: 0 },
          data: { field: "x", operation: "set", value: 1 },
        },
        {
          id: "c_out",
          type: "output",
          position: { x: 200, y: 0 },
          data: { outputs: { x: "{{nodes.c_val.output.result}}" } },
        },
      ],
      edges: [
        { id: "ce1", source: "c_in", target: "c_val" },
        { id: "ce2", source: "c_val", target: "c_out" },
      ],
    })

    const { flow_id: parentId } = await edem.flows.createFlow({
      name: "Multi Parent",
      trigger: { type: "manual" },
      nodes: [
        { id: "p_t", type: "trigger", position: { x: 0, y: 0 } },
        { id: "p_sub", type: "subflow", position: { x: 100, y: 0 }, data: { flow_id: childId } },
      ],
      edges: [{ id: "pe1", source: "p_t", target: "p_sub" }],
    })

    const r1 = await edem.flows.runFlow({ flow_id: parentId })
    const r2 = await edem.flows.runFlow({ flow_id: parentId })
    expect(r1.status).toBe("completed")
    expect(r2.status).toBe("completed")

    const { runs } = await edem.flows.listRuns({})
    const childRuns = runs.filter((r) => r.flow_id === childId)
    expect(childRuns.length).toBeGreaterThanOrEqual(2)
    expect(childRuns.every((r) => r.status === "completed")).toBe(true)
  })
})
