import { describe, it, expect } from "bun:test"
import { startDispatcher } from "../index"
import { getEdem, setupTests } from "./setup"

describe("dispatcher", () => {
  setupTests()
  it("startDispatcher returns emit", async () => {
    const edem = getEdem()
    const { emit } = await startDispatcher(edem.flows as any, edem.data as any)
    expect(typeof emit).toBe("function")
  })

  it("dispatcher triggers flow on matching event", async () => {
    const edem = getEdem()
    await edem.flows.createFlow({
      name: "Event Flow",
      trigger: { type: "event", event: "data.itemCreated" },
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
    emit("data.itemCreated", { id: "item-1", collection_id: "tasks", data: {} })

    await new Promise((r) => setTimeout(r, 50))

    const { runs } = await edem.flows.listRuns({})
    expect(runs.length).toBeGreaterThanOrEqual(1)
  })

  it("dispatcher ignores non-matching event", async () => {
    const edem = getEdem()
    await edem.flows.createFlow({
      name: "Event Flow",
      trigger: { type: "event", event: "data.itemCreated" },
    })

    const { emit } = await startDispatcher(edem.flows as any, edem.data as any)
    emit("data.itemUpdated", { id: "item-1", collection_id: "projects", data: {} })

    await new Promise((r) => setTimeout(r, 50))

    const { runs } = await edem.flows.listRuns({})
    expect(runs).toHaveLength(0)
  })

  it("dispatcher respects filter", async () => {
    const edem = getEdem()
    await edem.flows.createFlow({
      name: "Filtered Event",
      trigger: { type: "event", event: "data.itemCreated", filter: { status: "urgent" } },
    })

    const { emit } = await startDispatcher(edem.flows as any, edem.data as any)
    emit("data.itemCreated", { status: "normal" })

    await new Promise((r) => setTimeout(r, 50))

    const { runs } = await edem.flows.listRuns({})
    expect(runs).toHaveLength(0)
  })

  it("dispatcher multiple flows for same event", async () => {
    const edem = getEdem()
    await edem.flows.createFlow({
      name: "Flow A",
      trigger: { type: "event", event: "data.itemCreated" },
    })
    await edem.flows.createFlow({
      name: "Flow B",
      trigger: { type: "event", event: "data.itemCreated" },
    })

    const { emit } = await startDispatcher(edem.flows as any, edem.data as any)
    emit("data.itemCreated", { id: "item-1", collection_id: "tasks", data: {} })

    await new Promise((r) => setTimeout(r, 50))

    const { runs } = await edem.flows.listRuns({})
    expect(runs.length).toBe(2)
  })

  it("dispatcher filters by collection_id in event data", async () => {
    const edem = getEdem()
    await edem.flows.createFlow({
      name: "Tasks Only",
      trigger: { type: "event", event: "data.itemCreated", filter: { collection_id: "tasks" } },
    })

    const { emit } = await startDispatcher(edem.flows as any, edem.data as any)
    emit("data.itemCreated", { id: "item-1", collection_id: "projects", data: {} })

    await new Promise((r) => setTimeout(r, 50))

    const { runs } = await edem.flows.listRuns({})
    expect(runs).toHaveLength(0)
  })

  it("dispatcher handles deleted item events", async () => {
    const edem = getEdem()
    await edem.flows.createFlow({
      name: "Delete Flow",
      trigger: { type: "event", event: "data.itemDeleted" },
    })

    const { emit } = await startDispatcher(edem.flows as any, edem.data as any)
    emit("data.itemDeleted", { item_id: "item-1", collection_id: "tasks" })

    await new Promise((r) => setTimeout(r, 50))

    const { runs } = await edem.flows.listRuns({})
    expect(runs.length).toBeGreaterThanOrEqual(1)
  })
})
