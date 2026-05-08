import { describe, it, expect } from "bun:test"
import { reg } from "../test-actions"
import { getEdem, setupTests } from "./setup"

describe("error handling", () => {
  setupTests()
  it("unknown node type returns error", async () => {
    const edem = getEdem()
    const { flow_id } = await edem.flows.createFlow({
      name: "Bad Type",
      trigger: { type: "manual" },
      nodes: [
        { id: "t", type: "trigger", position: { x: 0, y: 0 } },
        { id: "bad", type: "nonexistent_type", position: { x: 100, y: 0 } },
      ],
      edges: [{ id: "e1", source: "t", target: "bad" }],
    })

    const result = await edem.flows.runFlow({ flow_id })
    expect(result.status).toBe("error")

    const { run } = await edem.flows.getRun({ run_id: result.run_id })
    expect(run?.error).toContain("Unknown node type")
  })

  it("node retry with retry_max", async () => {
    const edem = getEdem()
    let attempts = 0
    reg("e2e_flaky", async () => {
      attempts++
      if (attempts < 3) throw new Error(`Attempt ${attempts} failed`)
      return { success: true }
    })

    const { flow_id } = await edem.flows.createFlow({
      name: "Retry",
      trigger: { type: "manual" },
      nodes: [
        { id: "t", type: "trigger", position: { x: 0, y: 0 } },
        {
          id: "retry",
          type: "action",
          position: { x: 100, y: 0 },
          data: { module: "test", proc: "e2e_flaky" },
          retry_max: 2,
          retry_delay: 10,
        },
        {
          id: "out",
          type: "transform",
          position: { x: 200, y: 0 },
          data: { field: "done", operation: "set", value: true },
        },
      ],
      edges: [
        { id: "e1", source: "t", target: "retry" },
        { id: "e2", source: "retry", target: "out" },
      ],
    })

    const result = await edem.flows.runFlow({ flow_id })
    expect(result.status).toBe("completed")
    expect(attempts).toBe(3)
  })

  it("non-existent flow throws", async () => {
    const edem = getEdem()
    await expect(edem.flows.runFlow({ flow_id: "nonexistent" })).rejects.toThrow("not found")
  })

  it("non-existent run throws on handleNodeCompleted", async () => {
    const edem = getEdem()
    await expect(
      edem.flows.handleNodeCompleted({ run_id: "nonexistent", node_id: "n1", output: {} }),
    ).rejects.toThrow("not found")
  })
})
