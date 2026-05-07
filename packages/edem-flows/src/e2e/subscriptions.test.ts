import { describe, it, expect } from "bun:test"
import { getEdem, setupTests } from "./setup"

describe("subscriptions", () => {
  setupTests()
  it("lifecycle events fire on node execution", async () => {
    const edem = getEdem()
    const startedNodes: string[] = []
    const completedNodes: string[] = []

    edem.flows.runNodeStarted((event) => {
      startedNodes.push(event.event.node_id)
    })
    edem.flows.runNodeCompleted((event) => {
      completedNodes.push(event.event.node_id)
    })

    const { flow_id } = await edem.flows.createFlow({
      name: "Events",
      trigger: { type: "manual" },
      nodes: [
        { id: "t", type: "trigger", position: { x: 0, y: 0 } },
        {
          id: "calc",
          type: "transform",
          position: { x: 100, y: 0 },
          data: { field: "x", operation: "set", value: 1 },
        },
      ],
      edges: [{ id: "e1", source: "t", target: "calc" }],
    })

    await edem.flows.runFlow({ flow_id })

    expect(startedNodes).toContain("t")
    expect(startedNodes).toContain("calc")
    expect(completedNodes).toContain("t")
    expect(completedNodes).toContain("calc")
  })

  it("run lifecycle events fire", async () => {
    const edem = getEdem()
    const runStartedIds: string[] = []
    const runCompletedIds: string[] = []

    edem.flows.runStarted((event) => {
      runStartedIds.push(event.event.id)
    })
    edem.flows.runCompleted((event) => {
      runCompletedIds.push(event.event.id)
    })

    const { flow_id } = await edem.flows.createFlow({
      name: "Run Events",
      trigger: { type: "manual" },
    })

    const result = await edem.flows.runFlow({ flow_id })

    expect(runStartedIds).toContain(result.run_id)
    expect(runCompletedIds).toContain(result.run_id)
  })

  it("flow CRUD events fire", async () => {
    const edem = getEdem()
    const createdIds: string[] = []
    const updatedIds: string[] = []
    const deletedIds: string[] = []

    edem.flows.flowCreated((event) => {
      createdIds.push((event.event as any).id)
    })
    edem.flows.flowUpdated((event) => {
      updatedIds.push((event.event as any).id)
    })
    edem.flows.flowDeleted((event) => {
      deletedIds.push((event.event as any).flow_id)
    })

    const { flow_id } = await edem.flows.createFlow({
      name: "CRUD Events",
      trigger: { type: "manual" },
    })

    expect(createdIds).toContain(flow_id)

    await edem.flows.updateFlow({ flow_id, name: "Updated" })
    expect(updatedIds).toContain(flow_id)

    await edem.flows.deleteFlow({ flow_id })
    expect(deletedIds).toContain(flow_id)
  })
})
