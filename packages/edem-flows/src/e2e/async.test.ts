import { describe, it, expect } from "bun:test"
import { registerAction } from "../index"
import { getEdem, setupTests } from "./setup"

describe("async control flow", () => {
  setupTests()
  it("handleNodeCompleted resumes waiting run", async () => {
    const edem = getEdem()
    const { flow_id } = await edem.flows.createFlow({
      name: "Resume",
      trigger: { type: "manual" },
      nodes: [
        { id: "t", type: "trigger", position: { x: 0, y: 0 } },
        {
          id: "wait",
          type: "action",
          position: { x: 100, y: 0 },
          data: { action: "e2e_resume_action" },
        },
        {
          id: "after",
          type: "transform",
          position: { x: 200, y: 0 },
          data: { field: "status", operation: "set", value: "approved" },
        },
      ],
      edges: [
        { id: "e1", source: "t", target: "wait" },
        { id: "e2", source: "wait", target: "after" },
      ],
    })

    const result = await edem.flows.runFlow({ flow_id })
    expect(result.status).toBe("waiting")

    const { run: waitingRun } = await edem.flows.getRun({ run_id: result.run_id })
    expect(waitingRun?.waiting_node_id).toBe("wait")

    registerAction("e2e_resume_action", async (input) => ({ approved: true, ...input }))

    const resumeResult = await edem.flows.handleNodeCompleted({
      run_id: result.run_id,
      node_id: "wait",
      output: { approved: true },
    })
    expect(resumeResult.success).toBe(true)

    const { run: completedRun } = await edem.flows.getRun({ run_id: result.run_id })
    expect(completedRun?.status).toBe("completed")
    expect(completedRun?.waiting_node_id).toBeNull()
  })

  it("handleNodeCompleted throws for wrong node_id", async () => {
    const edem = getEdem()
    const { flow_id } = await edem.flows.createFlow({
      name: "Wrong Node",
      trigger: { type: "manual" },
      nodes: [
        { id: "t", type: "trigger", position: { x: 0, y: 0 } },
        {
          id: "wait",
          type: "action",
          position: { x: 100, y: 0 },
          data: { action: "e2e_wrong_node_action" },
        },
      ],
      edges: [{ id: "e1", source: "t", target: "wait" }],
    })

    const result = await edem.flows.runFlow({ flow_id })
    expect(result.status).toBe("waiting")

    await expect(
      edem.flows.handleNodeCompleted({ run_id: result.run_id, node_id: "wrong", output: {} }),
    ).rejects.toThrow("not waiting for node")
  })

  it("handleNodeFailed fails waiting run", async () => {
    const edem = getEdem()
    const { flow_id } = await edem.flows.createFlow({
      name: "Fail",
      trigger: { type: "manual" },
      nodes: [
        { id: "t", type: "trigger", position: { x: 0, y: 0 } },
        {
          id: "wait",
          type: "action",
          position: { x: 100, y: 0 },
          data: { action: "e2e_fail_action" },
        },
      ],
      edges: [{ id: "e1", source: "t", target: "wait" }],
    })

    const result = await edem.flows.runFlow({ flow_id })
    expect(result.status).toBe("waiting")

    const failResult = await edem.flows.handleNodeFailed({
      run_id: result.run_id,
      node_id: "wait",
      error: "Timeout exceeded",
    })
    expect(failResult.success).toBe(true)

    const { run } = await edem.flows.getRun({ run_id: result.run_id })
    expect(run?.status).toBe("error")
    expect(run?.error).toBe("Timeout exceeded")
  })

  it("cancelRun cancels waiting run", async () => {
    const edem = getEdem()
    const { flow_id } = await edem.flows.createFlow({
      name: "Cancel",
      trigger: { type: "manual" },
      nodes: [
        { id: "t", type: "trigger", position: { x: 0, y: 0 } },
        {
          id: "wait",
          type: "action",
          position: { x: 100, y: 0 },
          data: { action: "e2e_cancel_action" },
        },
      ],
      edges: [{ id: "e1", source: "t", target: "wait" }],
    })

    const result = await edem.flows.runFlow({ flow_id })
    expect(result.status).toBe("waiting")

    const cancelResult = await edem.flows.cancelRun({ run_id: result.run_id })
    expect(cancelResult.success).toBe(true)

    const { run } = await edem.flows.getRun({ run_id: result.run_id })
    expect(run?.status).toBe("cancelled")
    expect(run?.completed_at).toBeDefined()
  })

  it("cancelRun throws for completed run", async () => {
    const edem = getEdem()
    const { flow_id } = await edem.flows.createFlow({
      name: "Done",
      trigger: { type: "manual" },
    })

    const result = await edem.flows.runFlow({ flow_id })
    expect(result.status).toBe("completed")

    await expect(edem.flows.cancelRun({ run_id: result.run_id })).rejects.toThrow("Cannot cancel")
  })

  it("run state transitions: pending → waiting → running → completed", async () => {
    const edem = getEdem()
    const { flow_id } = await edem.flows.createFlow({
      name: "Transitions",
      trigger: { type: "manual" },
      nodes: [
        { id: "t", type: "trigger", position: { x: 0, y: 0 } },
        {
          id: "act",
          type: "action",
          position: { x: 100, y: 0 },
          data: { action: "e2e_transitions_action" },
        },
        {
          id: "after",
          type: "transform",
          position: { x: 200, y: 0 },
          data: { field: "done", operation: "set", value: true },
        },
      ],
      edges: [
        { id: "e1", source: "t", target: "act" },
        { id: "e2", source: "act", target: "after" },
      ],
    })

    const result = await edem.flows.runFlow({ flow_id })
    expect(result.status).toBe("waiting")

    const { run: waitingRun } = await edem.flows.getRun({ run_id: result.run_id })
    expect(waitingRun?.status).toBe("waiting")

    registerAction("e2e_transitions_action", async (input) => ({ step: 1, ...input }))

    await edem.flows.handleNodeCompleted({
      run_id: result.run_id,
      node_id: "act",
      output: { step: 1 },
    })

    const { run: finalRun } = await edem.flows.getRun({ run_id: result.run_id })
    expect(finalRun?.status).toBe("completed")
  })
})
