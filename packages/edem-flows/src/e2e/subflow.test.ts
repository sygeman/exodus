import { describe, it, expect } from "bun:test"
import { registerAction } from "../index"
import { getEdem, setupTests } from "./setup"

describe("subflow", () => {
  setupTests()
  it("subflow completes and injects output", async () => {
    const edem = getEdem()
    const { flow_id: childId } = await edem.flows.createFlow({
      name: "Child",
      trigger: { type: "manual" },
      nodes: [
        { id: "c_t", type: "trigger", position: { x: 0, y: 0 } },
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
        { id: "ce1", source: "c_t", target: "c_calc" },
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
          id: "p_out",
          type: "output",
          position: { x: 200, y: 0 },
          data: { outputs: { parentDone: true } },
        },
      ],
      edges: [
        { id: "pe1", source: "p_t", target: "p_sub" },
        { id: "pe2", source: "p_sub", target: "p_out" },
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
      trigger: { type: "manual" },
      nodes: [{ id: "c_t", type: "trigger", position: { x: 0, y: 0 } }],
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
      trigger: { type: "manual" },
      nodes: [
        { id: "c_t", type: "trigger", position: { x: 0, y: 0 } },
        { id: "c_bad", type: "nonexistent_type_xyz", position: { x: 100, y: 0 } },
      ],
      edges: [{ id: "ce1", source: "c_t", target: "c_bad" }],
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

  it("subflow with async child (waiting) resumes parent after handleNodeCompleted on both", async () => {
    const edem = getEdem()
    const { flow_id: childId } = await edem.flows.createFlow({
      name: "Async Child",
      trigger: { type: "manual" },
      nodes: [
        { id: "c_t", type: "trigger", position: { x: 0, y: 0 } },
        {
          id: "c_wait",
          type: "action",
          position: { x: 100, y: 0 },
          data: { action: "e2e_subflow_async_action" },
        },
        {
          id: "c_out",
          type: "output",
          position: { x: 200, y: 0 },
          data: { outputs: { childDone: true } },
        },
      ],
      edges: [
        { id: "ce1", source: "c_t", target: "c_wait" },
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

    registerAction("e2e_subflow_async_action", async (input) => ({ confirmed: true, ...input }))

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
      trigger: { type: "manual" },
      nodes: [
        { id: "c_t", type: "trigger", position: { x: 0, y: 0 } },
        {
          id: "c_val",
          type: "transform",
          position: { x: 100, y: 0 },
          data: { field: "x", operation: "set", value: 1 },
        },
      ],
      edges: [{ id: "ce1", source: "c_t", target: "c_val" }],
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
