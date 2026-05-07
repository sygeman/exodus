import { describe, it, expect } from "bun:test"
import { startDispatcher } from "../index"
import { getEdem, setupTests } from "./setup"

describe("dispatcher", () => {
  setupTests()
  it("startDispatcher returns emit and triggerWebhook", async () => {
    const edem = getEdem()
    const { emit, triggerWebhook } = await startDispatcher(edem.flows as any, edem.data as any)
    expect(typeof emit).toBe("function")
    expect(typeof triggerWebhook).toBe("function")
  })

  it("dispatcher triggers flow on matching event", async () => {
    const edem = getEdem()
    await edem.flows.createFlow({
      name: "Event Flow",
      trigger: { type: "event", event: "item:created:tasks" },
      nodes: [
        { id: "t", type: "trigger", position: { x: 0, y: 0 } },
        {
          id: "out",
          type: "transform",
          position: { x: 100, y: 0 },
          data: { field: "triggered", operation: "set", value: true },
        },
      ],
      edges: [{ id: "e1", source: "t", target: "out" }],
    })

    const { emit } = await startDispatcher(edem.flows as any, edem.data as any)
    emit("item:created:tasks", { item: { id: "item-1", collection_id: "tasks", data: {} } })

    await new Promise((r) => setTimeout(r, 50))

    const { runs } = await edem.flows.listRuns({})
    expect(runs.length).toBeGreaterThanOrEqual(1)
  })

  it("dispatcher ignores non-matching event", async () => {
    const edem = getEdem()
    await edem.flows.createFlow({
      name: "Event Flow",
      trigger: { type: "event", event: "item:created:tasks" },
    })

    const { emit } = await startDispatcher(edem.flows as any, edem.data as any)
    emit("item:created:projects", { item: { id: "item-1", collection_id: "projects", data: {} } })

    await new Promise((r) => setTimeout(r, 50))

    const { runs } = await edem.flows.listRuns({})
    expect(runs).toHaveLength(0)
  })

  it("dispatcher respects filter", async () => {
    const edem = getEdem()
    await edem.flows.createFlow({
      name: "Filtered Event",
      trigger: { type: "event", event: "item:created:tasks", filter: { status: "urgent" } },
    })

    const { emit } = await startDispatcher(edem.flows as any, edem.data as any)
    emit("item:created:tasks", { status: "normal" })

    await new Promise((r) => setTimeout(r, 50))

    const { runs } = await edem.flows.listRuns({})
    expect(runs).toHaveLength(0)
  })

  it("dispatcher triggers webhook flow", async () => {
    const edem = getEdem()
    await edem.flows.createFlow({
      name: "Webhook Flow",
      trigger: { type: "webhook", path: "/hooks/deploy" },
      nodes: [
        { id: "t", type: "trigger", position: { x: 0, y: 0 } },
        {
          id: "out",
          type: "transform",
          position: { x: 100, y: 0 },
          data: { field: "deployed", operation: "set", value: true },
        },
      ],
      edges: [{ id: "e1", source: "t", target: "out" }],
    })

    const { triggerWebhook } = await startDispatcher(edem.flows as any, edem.data as any)
    triggerWebhook("/hooks/deploy", { repo: "exodus" })

    await new Promise((r) => setTimeout(r, 50))

    const { runs } = await edem.flows.listRuns({})
    expect(runs.length).toBeGreaterThanOrEqual(1)
  })

  it("dispatcher multiple flows for same event", async () => {
    const edem = getEdem()
    await edem.flows.createFlow({
      name: "Flow A",
      trigger: { type: "event", event: "item:created:tasks" },
    })
    await edem.flows.createFlow({
      name: "Flow B",
      trigger: { type: "event", event: "item:created:tasks" },
    })

    const { emit } = await startDispatcher(edem.flows as any, edem.data as any)
    emit("item:created:tasks", { item: { id: "item-1", collection_id: "tasks", data: {} } })

    await new Promise((r) => setTimeout(r, 50))

    const { runs } = await edem.flows.listRuns({})
    expect(runs.length).toBe(2)
  })
})
