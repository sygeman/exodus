import { describe, it, expect } from "bun:test"
import { registerAction } from "../index"
import { getEdem, setupTests } from "./setup"

describe("node chains", () => {
  setupTests()
  it("condition true branch", async () => {
    const edem = getEdem()
    const { flow_id } = await edem.flows.createFlow({
      name: "Cond True",
      trigger: { type: "manual" },
      nodes: [
        { id: "t", type: "trigger", position: { x: 0, y: 0 } },
        {
          id: "cond",
          type: "condition",
          position: { x: 100, y: 0 },
          data: { field: "status", value: "active", operator: "eq" },
        },
        {
          id: "yes",
          type: "transform",
          position: { x: 200, y: 0 },
          data: { field: "result", operation: "set", value: "approved" },
        },
        {
          id: "no",
          type: "transform",
          position: { x: 200, y: 100 },
          data: { field: "result", operation: "set", value: "rejected" },
        },
      ],
      edges: [
        { id: "e1", source: "t", target: "cond" },
        { id: "e2", source: "cond", target: "yes", sourceHandle: "true" },
        { id: "e3", source: "cond", target: "no", sourceHandle: "false" },
      ],
    })

    const result = await edem.flows.runFlow({ flow_id, trigger_data: { status: "active" } })
    expect(result.status).toBe("completed")

    const { run } = await edem.flows.getRun({ run_id: result.run_id })
    expect(run?.output?.yes).toEqual({ result: "approved" })
    expect(run?.output?.no).toBeUndefined()
  })

  it("condition false branch", async () => {
    const edem = getEdem()
    const { flow_id } = await edem.flows.createFlow({
      name: "Cond False",
      trigger: { type: "manual" },
      nodes: [
        { id: "t", type: "trigger", position: { x: 0, y: 0 } },
        {
          id: "cond",
          type: "condition",
          position: { x: 100, y: 0 },
          data: { field: "status", value: "active", operator: "eq" },
        },
        {
          id: "yes",
          type: "transform",
          position: { x: 200, y: 0 },
          data: { field: "result", operation: "set", value: "approved" },
        },
        {
          id: "no",
          type: "transform",
          position: { x: 200, y: 100 },
          data: { field: "result", operation: "set", value: "rejected" },
        },
      ],
      edges: [
        { id: "e1", source: "t", target: "cond" },
        { id: "e2", source: "cond", target: "yes", sourceHandle: "true" },
        { id: "e3", source: "cond", target: "no", sourceHandle: "false" },
      ],
    })

    const result = await edem.flows.runFlow({ flow_id, trigger_data: { status: "draft" } })
    expect(result.status).toBe("completed")

    const { run } = await edem.flows.getRun({ run_id: result.run_id })
    expect(run?.output?.no).toEqual({ result: "rejected" })
    expect(run?.output?.yes).toBeUndefined()
  })

  it("switch routing with default", async () => {
    const edem = getEdem()
    const { flow_id } = await edem.flows.createFlow({
      name: "Switch",
      trigger: { type: "manual" },
      nodes: [
        { id: "t", type: "trigger", position: { x: 0, y: 0 } },
        {
          id: "sw",
          type: "switch",
          position: { x: 100, y: 0 },
          data: {
            value: "{{trigger.type}}",
            cases: [
              { value: "alpha", handle: "case_a" },
              { value: "beta", handle: "case_b" },
            ],
            default_handle: "default",
          },
        },
        {
          id: "a",
          type: "transform",
          position: { x: 200, y: 0 },
          data: { field: "selected", operation: "set", value: "A" },
        },
        {
          id: "b",
          type: "transform",
          position: { x: 200, y: 100 },
          data: { field: "selected", operation: "set", value: "B" },
        },
        {
          id: "d",
          type: "transform",
          position: { x: 200, y: 200 },
          data: { field: "selected", operation: "set", value: "default" },
        },
      ],
      edges: [
        { id: "e1", source: "t", target: "sw" },
        { id: "e2", source: "sw", target: "a", label: "case_a" },
        { id: "e3", source: "sw", target: "b", label: "case_b" },
        { id: "e4", source: "sw", target: "d", label: "default" },
      ],
    })

    const result = await edem.flows.runFlow({ flow_id, trigger_data: { type: "beta" } })
    expect(result.status).toBe("completed")

    const { run } = await edem.flows.getRun({ run_id: result.run_id })
    expect(run?.output?.b).toEqual({ result: "B" })
    expect(run?.output?.a).toBeUndefined()
    expect(run?.output?.d).toBeUndefined()
  })

  it("transform chain: add → multiply → set", async () => {
    const edem = getEdem()
    const { flow_id } = await edem.flows.createFlow({
      name: "Chain",
      trigger: { type: "manual" },
      nodes: [
        { id: "t", type: "trigger", position: { x: 0, y: 0 } },
        {
          id: "add",
          type: "transform",
          position: { x: 100, y: 0 },
          data: { field: "x", operation: "add", value: 10 },
        },
        {
          id: "mul",
          type: "transform",
          position: { x: 200, y: 0 },
          data: { field: "result", operation: "multiply", value: 2 },
        },
        {
          id: "set",
          type: "transform",
          position: { x: 300, y: 0 },
          data: { field: "final", operation: "set", value: "done" },
        },
      ],
      edges: [
        { id: "e1", source: "t", target: "add" },
        { id: "e2", source: "add", target: "mul" },
        { id: "e3", source: "mul", target: "set" },
      ],
    })

    const result = await edem.flows.runFlow({ flow_id, trigger_data: { x: 5 } })
    expect(result.status).toBe("completed")

    const { run } = await edem.flows.getRun({ run_id: result.run_id })
    expect(run?.output?.add).toEqual({ result: 15 })
    expect(run?.output?.mul).toEqual({ result: 30 })
    expect(run?.output?.set).toEqual({ result: "done" })
  })

  it("fork + join parallel branches", async () => {
    const edem = getEdem()
    const { flow_id } = await edem.flows.createFlow({
      name: "ForkJoin",
      trigger: { type: "manual" },
      nodes: [
        { id: "t", type: "trigger", position: { x: 0, y: 0 } },
        {
          id: "fork",
          type: "fork",
          position: { x: 100, y: 0 },
          data: { branches: [{ id: "branch_a" }, { id: "branch_b" }] },
        },
        {
          id: "a",
          type: "transform",
          position: { x: 200, y: 0 },
          data: { field: "branch_a", operation: "set", value: "A" },
        },
        {
          id: "b",
          type: "transform",
          position: { x: 200, y: 100 },
          data: { field: "branch_b", operation: "set", value: "B" },
        },
        { id: "join", type: "join", position: { x: 300, y: 50 }, data: { mode: "all" } },
      ],
      edges: [
        { id: "e1", source: "t", target: "fork" },
        { id: "e2", source: "fork", target: "a", label: "branch_a" },
        { id: "e3", source: "fork", target: "b", label: "branch_b" },
        { id: "e4", source: "a", target: "join" },
        { id: "e5", source: "b", target: "join" },
      ],
    })

    const result = await edem.flows.runFlow({ flow_id, trigger_data: {} })
    expect(result.status).toBe("completed")

    const { run } = await edem.flows.getRun({ run_id: result.run_id })
    expect(run?.output?.a).toEqual({ result: "A" })
    expect(run?.output?.b).toEqual({ result: "B" })
    expect((run?.output?.join as Record<string, unknown>)?.status).toBe("completed")
  })

  it("template resolution: trigger, nodes, output", async () => {
    const edem = getEdem()
    const { flow_id } = await edem.flows.createFlow({
      name: "Templates",
      trigger: { type: "manual" },
      nodes: [
        { id: "t", type: "trigger", position: { x: 0, y: 0 } },
        {
          id: "calc",
          type: "transform",
          position: { x: 100, y: 0 },
          data: { field: "val", operation: "set", value: "{{trigger.input_val}}" },
        },
        {
          id: "out",
          type: "output",
          position: { x: 200, y: 0 },
          data: {
            outputs: { fromTrigger: "{{trigger.name}}", fromNode: "{{nodes.calc.output.result}}" },
          },
        },
      ],
      edges: [
        { id: "e1", source: "t", target: "calc" },
        { id: "e2", source: "calc", target: "out" },
      ],
    })

    const result = await edem.flows.runFlow({
      flow_id,
      trigger_data: { name: "Alice", input_val: 42 },
    })
    expect(result.status).toBe("completed")

    const { nodes } = await edem.flows.getRunNodes({ run_id: result.run_id })
    const outNode = nodes.find((n) => n.node_id === "out")
    expect(outNode?.output?.outputs).toEqual({ fromTrigger: "Alice", fromNode: 42 })
  })

  it("input node extracts trigger inputs", async () => {
    const edem = getEdem()
    const { flow_id } = await edem.flows.createFlow({
      name: "Input Node",
      trigger: { type: "manual" },
      nodes: [
        { id: "t", type: "trigger", position: { x: 0, y: 0 } },
        { id: "inp", type: "input", position: { x: 100, y: 0 } },
      ],
      edges: [{ id: "e1", source: "t", target: "inp" }],
    })

    const result = await edem.flows.runFlow({
      flow_id,
      trigger_data: { inputs: { name: "Bob", age: 30 } },
    })
    expect(result.status).toBe("completed")

    const { run } = await edem.flows.getRun({ run_id: result.run_id })
    expect(run?.output?.inp).toEqual({ name: "Bob", age: 30 })
  })

  it("action with registered handler completes synchronously", async () => {
    const edem = getEdem()
    registerAction("e2e_sync_action", async (input) => ({ approved: true, ...input }))

    const { flow_id } = await edem.flows.createFlow({
      name: "Action Sync",
      trigger: { type: "manual" },
      nodes: [
        { id: "t", type: "trigger", position: { x: 0, y: 0 } },
        {
          id: "act",
          type: "action",
          position: { x: 100, y: 0 },
          data: { action: "e2e_sync_action" },
        },
        {
          id: "out",
          type: "transform",
          position: { x: 200, y: 0 },
          data: { field: "result", operation: "set", value: "done" },
        },
      ],
      edges: [
        { id: "e1", source: "t", target: "act" },
        { id: "e2", source: "act", target: "out" },
      ],
    })

    const result = await edem.flows.runFlow({ flow_id, trigger_data: { request: "approval" } })
    expect(result.status).toBe("completed")

    const { run } = await edem.flows.getRun({ run_id: result.run_id })
    expect((run?.output?.act as Record<string, unknown>)?.approved).toBe(true)
  })

  it("action without handler → waiting, register handler, handleNodeCompleted → completed", async () => {
    const edem = getEdem()
    const { flow_id } = await edem.flows.createFlow({
      name: "Action Async",
      trigger: { type: "manual" },
      nodes: [
        { id: "t", type: "trigger", position: { x: 0, y: 0 } },
        {
          id: "act",
          type: "action",
          position: { x: 100, y: 0 },
          data: { action: "e2e_later_action" },
        },
        {
          id: "next",
          type: "transform",
          position: { x: 200, y: 0 },
          data: { field: "after", operation: "set", value: "sent" },
        },
      ],
      edges: [
        { id: "e1", source: "t", target: "act" },
        { id: "e2", source: "act", target: "next" },
      ],
    })

    const result = await edem.flows.runFlow({ flow_id })
    expect(result.status).toBe("waiting")

    registerAction("e2e_later_action", async (input) => ({
      sent: true,
      messageId: "abc",
      ...input,
    }))

    const resumeResult = await edem.flows.handleNodeCompleted({
      run_id: result.run_id,
      node_id: "act",
      output: { sent: true, messageId: "abc" },
    })
    expect(resumeResult.success).toBe(true)

    const { run } = await edem.flows.getRun({ run_id: result.run_id })
    expect(run?.status).toBe("completed")
  })

  it("loop with maxIterations=3 via resume", async () => {
    const edem = getEdem()
    const { flow_id } = await edem.flows.createFlow({
      name: "Loop",
      trigger: { type: "manual" },
      nodes: [
        { id: "t", type: "trigger", position: { x: 0, y: 0 } },
        {
          id: "loop",
          type: "loop",
          position: { x: 100, y: 0 },
          data: { maxIterations: 3, action: "e2e_loop_action" },
        },
      ],
      edges: [{ id: "e1", source: "t", target: "loop" }],
    })

    const r1 = await edem.flows.runFlow({ flow_id })
    expect(r1.status).toBe("waiting")

    const r2 = await edem.flows.handleNodeCompleted({
      run_id: r1.run_id,
      node_id: "loop",
      output: { iteration: 1 },
    })
    expect(r2.success).toBe(true)

    const { run: midRun } = await edem.flows.getRun({ run_id: r1.run_id })
    expect(midRun?.status).toBe("waiting")

    const r3 = await edem.flows.handleNodeCompleted({
      run_id: r1.run_id,
      node_id: "loop",
      output: { iteration: 2, done: true },
    })
    expect(r3.success).toBe(true)

    const { run: finalRun } = await edem.flows.getRun({ run_id: r1.run_id })
    expect(finalRun?.status).toBe("completed")
  })

  it("delay node returns async and resumes via handleNodeCompleted", async () => {
    const edem = getEdem()
    const { flow_id } = await edem.flows.createFlow({
      name: "Delay",
      trigger: { type: "manual" },
      nodes: [
        { id: "t", type: "trigger", position: { x: 0, y: 0 } },
        { id: "d", type: "delay", position: { x: 100, y: 0 }, data: { seconds: 0 } },
        {
          id: "out",
          type: "transform",
          position: { x: 200, y: 0 },
          data: { field: "done", operation: "set", value: true },
        },
      ],
      edges: [
        { id: "e1", source: "t", target: "d" },
        { id: "e2", source: "d", target: "out" },
      ],
    })

    const result = await edem.flows.runFlow({ flow_id })
    expect(result.status).toBe("waiting")

    const { run } = await edem.flows.getRun({ run_id: result.run_id })
    expect(run?.waiting_node_id).toBe("d")

    const { nodes } = await edem.flows.getRunNodes({ run_id: result.run_id })
    const delayNode = nodes.find((n) => n.node_id === "d")
    expect(delayNode?.output?.delayed_seconds).toBe(1)

    const resumeResult = await edem.flows.handleNodeCompleted({
      run_id: result.run_id,
      node_id: "d",
      output: { status: "completed", delayed_seconds: 1 },
    })
    expect(resumeResult.success).toBe(true)

    const { run: finalRun } = await edem.flows.getRun({ run_id: result.run_id })
    expect(finalRun?.status).toBe("completed")
  })

  it("fork + join with async branches — join waits for all branches", async () => {
    const edem = getEdem()
    const { flow_id } = await edem.flows.createFlow({
      name: "Async ForkJoin",
      trigger: { type: "manual" },
      nodes: [
        { id: "t", type: "trigger", position: { x: 0, y: 0 } },
        {
          id: "fork",
          type: "fork",
          position: { x: 100, y: 0 },
          data: { branches: [{ id: "branch_a" }, { id: "branch_b" }] },
        },
        {
          id: "action_a",
          type: "action",
          position: { x: 200, y: 0 },
          data: { action: "e2e_fork_action_a" },
        },
        {
          id: "action_b",
          type: "action",
          position: { x: 200, y: 100 },
          data: { action: "e2e_fork_action_b" },
        },
        { id: "join", type: "join", position: { x: 300, y: 50 }, data: { mode: "all" } },
      ],
      edges: [
        { id: "e1", source: "t", target: "fork" },
        { id: "e2", source: "fork", target: "action_a", label: "branch_a" },
        { id: "e3", source: "fork", target: "action_b", label: "branch_b" },
        { id: "e4", source: "action_a", target: "join" },
        { id: "e5", source: "action_b", target: "join" },
      ],
    })

    const result = await edem.flows.runFlow({ flow_id, trigger_data: {} })
    expect(result.status).toBe("waiting")

    registerAction("e2e_fork_action_a", async (input) => ({ branch: "a", ...input }))
    registerAction("e2e_fork_action_b", async (input) => ({ branch: "b", ...input }))

    const r2 = await edem.flows.handleNodeCompleted({
      run_id: result.run_id,
      node_id: "action_a",
      output: { branch: "a" },
    })
    expect(r2.success).toBe(true)

    const { run: finalRun } = await edem.flows.getRun({ run_id: result.run_id })
    expect(finalRun?.status).toBe("completed")
    expect((finalRun?.output?.join as Record<string, unknown>)?.status).toBe("completed")
  })

  it("loop auto-iteration with registered handler", async () => {
    const edem = getEdem()
    registerAction("e2e_auto_loop", async (input) => {
      const iter = (input.iteration as number) ?? 0
      return { processed: iter, doubled: iter * 2 }
    })

    const { flow_id } = await edem.flows.createFlow({
      name: "Auto Loop",
      trigger: { type: "manual" },
      nodes: [
        { id: "t", type: "trigger", position: { x: 0, y: 0 } },
        {
          id: "loop",
          type: "loop",
          position: { x: 100, y: 0 },
          data: { maxIterations: 5, action: "e2e_auto_loop", autoIterate: true },
        },
      ],
      edges: [{ id: "e1", source: "t", target: "loop" }],
    })

    const result = await edem.flows.runFlow({ flow_id, trigger_data: {} })
    expect(result.status).toBe("completed")

    const { run } = await edem.flows.getRun({ run_id: result.run_id })
    expect(run?.output?.loop).toBeDefined()
    const loopOutput = run?.output?.loop as Record<string, unknown>
    expect(loopOutput.status).toBe("completed")
    expect(loopOutput.iterations).toBe(5)
    expect(loopOutput.final).toBe(true)
    expect(loopOutput.results).toEqual([
      { processed: 1, doubled: 2 },
      { processed: 2, doubled: 4 },
      { processed: 3, doubled: 6 },
      { processed: 4, doubled: 8 },
      { processed: 5, doubled: 10 },
    ])
  })

  it("fork + join — branch error propagates", async () => {
    const edem = getEdem()
    const { flow_id } = await edem.flows.createFlow({
      name: "ForkJoin Error",
      trigger: { type: "manual" },
      nodes: [
        { id: "t", type: "trigger", position: { x: 0, y: 0 } },
        {
          id: "fork",
          type: "fork",
          position: { x: 100, y: 0 },
          data: { branches: [{ id: "branch_a" }, { id: "branch_b" }] },
        },
        {
          id: "action_a",
          type: "action",
          position: { x: 200, y: 0 },
          data: { action: "e2e_fork_err_action_a" },
        },
        {
          id: "action_b",
          type: "action",
          position: { x: 200, y: 100 },
          data: { action: "e2e_fork_err_action_b" },
        },
        { id: "join", type: "join", position: { x: 300, y: 50 }, data: { mode: "all" } },
      ],
      edges: [
        { id: "e1", source: "t", target: "fork" },
        { id: "e2", source: "fork", target: "action_a", label: "branch_a" },
        { id: "e3", source: "fork", target: "action_b", label: "branch_b" },
        { id: "e4", source: "action_a", target: "join" },
        { id: "e5", source: "action_b", target: "join" },
      ],
    })

    registerAction("e2e_fork_err_action_a", async () => {
      throw new Error("branch_a failed")
    })
    registerAction("e2e_fork_err_action_b", async (input) => ({ branch: "b", ...input }))

    const result = await edem.flows.runFlow({ flow_id, trigger_data: {} })
    expect(result.status).toBe("error")
  })
})
