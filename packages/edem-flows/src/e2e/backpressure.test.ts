import { describe, it, expect } from "bun:test"
import { getEdem, setupTests } from "./setup"

describe("backpressure", () => {
  setupTests()

  it("maxConcurrent limits running+waiting runs", async () => {
    const edem = getEdem()
    const { flow_id } = await edem.flows.createFlow({
      name: "BP Concurrent",
      trigger: { type: "manual" },
      nodes: [
        { id: "t", type: "trigger", position: { x: 0, y: 0 } },
        {
          id: "wait",
          type: "action",
          position: { x: 100, y: 0 },
          data: { action: "e2e_bp_action" },
        },
      ],
      edges: [{ id: "e1", source: "t", target: "wait" }],
      backpressure: { maxConcurrent: 1 },
    })

    const r1 = await edem.flows.runFlow({ flow_id })
    expect(r1.status).toBe("waiting")

    const { run: waitingRun } = await edem.flows.getRun({ run_id: r1.run_id })
    expect(waitingRun?.status).toBe("waiting")

    await expect(edem.flows.runFlow({ flow_id })).rejects.toThrow()
  })

  it("maxPending limits waiting runs", async () => {
    const edem = getEdem()
    const { flow_id } = await edem.flows.createFlow({
      name: "BP Pending",
      trigger: { type: "manual" },
      nodes: [
        { id: "t", type: "trigger", position: { x: 0, y: 0 } },
        {
          id: "wait",
          type: "action",
          position: { x: 100, y: 0 },
          data: { action: "e2e_bp_pending_action" },
        },
      ],
      edges: [{ id: "e1", source: "t", target: "wait" }],
      backpressure: { maxPending: 1 },
    })

    const r1 = await edem.flows.runFlow({ flow_id })
    expect(r1.status).toBe("waiting")

    const { run: waitingRun } = await edem.flows.getRun({ run_id: r1.run_id })
    expect(waitingRun?.status).toBe("waiting")

    await expect(edem.flows.runFlow({ flow_id })).rejects.toThrow()
  })

  it("updateFlow can add backpressure", async () => {
    const edem = getEdem()
    const { flow_id } = await edem.flows.createFlow({
      name: "No BP",
      trigger: { type: "manual" },
      nodes: [
        { id: "t", type: "trigger", position: { x: 0, y: 0 } },
        {
          id: "wait",
          type: "action",
          position: { x: 100, y: 0 },
          data: { action: "e2e_bp_update_action" },
        },
      ],
      edges: [{ id: "e1", source: "t", target: "wait" }],
    })

    const r1 = await edem.flows.runFlow({ flow_id })
    expect(r1.status).toBe("waiting")

    await edem.flows.updateFlow({
      flow_id,
      backpressure: { maxConcurrent: 1 },
    })

    await expect(edem.flows.runFlow({ flow_id })).rejects.toThrow()
  })

  it("updateFlow can change backpressure limits", async () => {
    const edem = getEdem()
    const { flow_id } = await edem.flows.createFlow({
      name: "BP Change",
      trigger: { type: "manual" },
      nodes: [
        { id: "t", type: "trigger", position: { x: 0, y: 0 } },
        {
          id: "wait",
          type: "action",
          position: { x: 100, y: 0 },
          data: { action: "e2e_bp_change_action" },
        },
      ],
      edges: [{ id: "e1", source: "t", target: "wait" }],
      backpressure: { maxConcurrent: 2 },
    })

    const r1 = await edem.flows.runFlow({ flow_id })
    expect(r1.status).toBe("waiting")

    const r2 = await edem.flows.runFlow({ flow_id })
    expect(r2.status).toBe("waiting")

    await edem.flows.updateFlow({
      flow_id,
      backpressure: { maxConcurrent: 1 },
    })

    await expect(edem.flows.runFlow({ flow_id })).rejects.toThrow()
  })

  it("completed run frees backpressure slot", async () => {
    const edem = getEdem()
    const { flow_id } = await edem.flows.createFlow({
      name: "BP Free",
      trigger: { type: "manual" },
      backpressure: { maxConcurrent: 1 },
    })

    const r1 = await edem.flows.runFlow({ flow_id })
    expect(r1.status).toBe("completed")

    const r2 = await edem.flows.runFlow({ flow_id })
    expect(r2.status).toBe("completed")
  })

  it("concurrent runs with maxConcurrent=2", async () => {
    const edem = getEdem()
    const { flow_id } = await edem.flows.createFlow({
      name: "BP Concurrent 2",
      trigger: { type: "manual" },
      nodes: [
        { id: "t", type: "trigger", position: { x: 0, y: 0 } },
        {
          id: "wait",
          type: "action",
          position: { x: 100, y: 0 },
          data: { action: "e2e_bp_concurrent_action" },
        },
      ],
      edges: [{ id: "e1", source: "t", target: "wait" }],
      backpressure: { maxConcurrent: 2 },
    })

    const r1 = await edem.flows.runFlow({ flow_id })
    expect(r1.status).toBe("waiting")

    const r2 = await edem.flows.runFlow({ flow_id })
    expect(r2.status).toBe("waiting")

    await expect(edem.flows.runFlow({ flow_id })).rejects.toThrow()
  })

  it("error run frees backpressure slot", async () => {
    const edem = getEdem()
    const { flow_id } = await edem.flows.createFlow({
      name: "BP Error Free",
      trigger: { type: "manual" },
      nodes: [
        { id: "t", type: "trigger", position: { x: 0, y: 0 } },
        {
          id: "wait",
          type: "action",
          position: { x: 100, y: 0 },
          data: { action: "e2e_bp_error_action" },
        },
      ],
      edges: [{ id: "e1", source: "t", target: "wait" }],
      backpressure: { maxConcurrent: 1 },
    })

    const r1 = await edem.flows.runFlow({ flow_id })
    expect(r1.status).toBe("waiting")

    await edem.flows.handleNodeFailed({
      run_id: r1.run_id,
      node_id: "wait",
      error: "Test failure",
    })

    const r2 = await edem.flows.runFlow({ flow_id })
    expect(r2.status).toBe("waiting")
  })
})
