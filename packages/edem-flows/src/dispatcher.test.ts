import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test"
import { canonicalFlowShape } from "./test-flow"

function createMockFlows() {
  return {
    runFlow: mock(() => Promise.resolve({ run_id: "run-1", status: "running" })),
    listFlows: mock(() =>
      Promise.resolve({
        flows: [],
      }),
    ),
    flowCreated: mock(() => () => {}),
    flowUpdated: mock(() => () => {}),
    flowDeleted: mock(() => () => {}),
  }
}

function createMockData(items: Array<{ id: string; data: Record<string, unknown> }> = []) {
  return {
    queryItems: mock(() => Promise.resolve({ items })),
  }
}

describe("startDispatcher", () => {
  let startDispatcher: typeof import("./dispatcher").startDispatcher
  let originalLog: typeof console.log

  beforeEach(async () => {
    const mod = await import("./dispatcher")
    startDispatcher = mod.startDispatcher
    originalLog = console.log
    console.log = mock(() => {})
  })

  afterEach(() => {
    console.log = originalLog
  })

  it("should return emit function", async () => {
    const flows = createMockFlows()
    const data = createMockData([])

    const result = await startDispatcher(flows as any, data as any)

    expect(result).toHaveProperty("emit")
    expect(typeof result.emit).toBe("function")
  })

  it("should query flows on startup", async () => {
    const flows = createMockFlows()
    const data = createMockData([])

    await startDispatcher(flows as any, data as any)

    expect(data.queryItems).toHaveBeenCalledWith({
      collection_id: "flows",
      filter: undefined,
    })
  })

  it("should query only scoped flows when filter is provided", async () => {
    const flows = createMockFlows()
    const data = createMockData([])
    const flowFilter = { project_id: { _eq: null } }

    await startDispatcher(flows as any, data as any, { flowFilter })

    expect(data.queryItems).toHaveBeenCalledWith({
      collection_id: "flows",
      filter: flowFilter,
    })
  })

  it("should register flow lifecycle handlers", async () => {
    const flows = createMockFlows()
    const data = createMockData([])

    await startDispatcher(flows as any, data as any)

    expect(flows.flowCreated).toHaveBeenCalled()
    expect(flows.flowUpdated).toHaveBeenCalled()
    expect(flows.flowDeleted).toHaveBeenCalled()
  })

  it("should build event index from flows", async () => {
    const flows = createMockFlows()
    const data = createMockData([
      {
        id: "flow-1",
        data: {
          ...canonicalFlowShape({ trigger: { type: "event", event: "data.itemCreated" } }),
        },
      },
      {
        id: "flow-2",
        data: {
          ...canonicalFlowShape({ trigger: { type: "event", event: "data.itemUpdated" } }),
        },
      },
    ])

    await startDispatcher(flows as any, data as any)

    expect(console.log).toHaveBeenCalled()
  })

  it("should not index non-event triggers", async () => {
    const flows = createMockFlows()
    const data = createMockData([
      {
        id: "flow-1",
        data: {
          ...canonicalFlowShape({ trigger: { type: "manual" } }),
        },
      },
      {
        id: "flow-2",
        data: {
          ...canonicalFlowShape({ trigger: { type: "schedule", every: "1h" } }),
        },
      },
    ])

    await startDispatcher(flows as any, data as any)

    expect(console.log).toHaveBeenCalled()
  })

  it("should trigger matching flows on item events", async () => {
    const flows = createMockFlows()
    const data = createMockData([
      {
        id: "flow-1",
        data: {
          ...canonicalFlowShape({ trigger: { type: "event", event: "data.itemCreated" } }),
        },
      },
    ])

    const { emit } = await startDispatcher(flows as any, data as any)

    emit("data.itemCreated", { id: "item-1", collection_id: "tasks", data: {} })

    expect(flows.runFlow).toHaveBeenCalledWith({
      flow_id: "flow-1",
      trigger_data: { id: "item-1", collection_id: "tasks", data: {} },
    })
  })

  it("should index event triggers from trigger node source", async () => {
    const flows = createMockFlows()
    const data = createMockData([
      {
        id: "flow-1",
        data: {
          nodes: [
            {
              id: "trigger",
              type: "trigger",
              data: { source: { type: "event", event: "data.itemCreated" } },
            },
          ],
        },
      },
    ])

    const { emit } = await startDispatcher(flows as any, data as any)

    emit("data.itemCreated", { id: "item-1", collection_id: "tasks", data: {} })

    expect(flows.runFlow).toHaveBeenCalledWith({
      flow_id: "flow-1",
      trigger_data: { id: "item-1", collection_id: "tasks", data: {} },
    })
  })

  it("should not trigger non-matching flows", async () => {
    const flows = createMockFlows()
    const data = createMockData([
      {
        id: "flow-1",
        data: {
          ...canonicalFlowShape({ trigger: { type: "event", event: "data.itemCreated" } }),
        },
      },
    ])

    const { emit } = await startDispatcher(flows as any, data as any)

    emit("data.itemUpdated", { id: "item-1", collection_id: "projects", data: {} })

    expect(flows.runFlow).not.toHaveBeenCalled()
  })

  it("should match flows with filter", async () => {
    const flows = createMockFlows()
    const data = createMockData([
      {
        id: "flow-1",
        data: {
          ...canonicalFlowShape({
            trigger: { type: "event", event: "data.itemCreated", filter: { status: "urgent" } },
          }),
        },
      },
    ])

    const { emit } = await startDispatcher(flows as any, data as any)

    emit("data.itemCreated", { id: "item-1", collection_id: "tasks", status: "urgent" })

    expect(flows.runFlow).toHaveBeenCalled()
  })

  it("should not trigger flows when filter does not match", async () => {
    const flows = createMockFlows()
    const data = createMockData([
      {
        id: "flow-1",
        data: {
          ...canonicalFlowShape({
            trigger: { type: "event", event: "data.itemCreated", filter: { status: "urgent" } },
          }),
        },
      },
    ])

    const { emit } = await startDispatcher(flows as any, data as any)

    emit("data.itemCreated", { id: "item-1", collection_id: "tasks", status: "normal" })

    expect(flows.runFlow).not.toHaveBeenCalled()
  })

  it("should handle multiple flows for same event", async () => {
    const flows = createMockFlows()
    const data = createMockData([
      {
        id: "flow-1",
        data: {
          ...canonicalFlowShape({ trigger: { type: "event", event: "data.itemCreated" } }),
        },
      },
      {
        id: "flow-2",
        data: {
          ...canonicalFlowShape({ trigger: { type: "event", event: "data.itemCreated" } }),
        },
      },
    ])

    const { emit } = await startDispatcher(flows as any, data as any)

    emit("data.itemCreated", { id: "item-1", collection_id: "tasks", data: {} })

    expect(flows.runFlow).toHaveBeenCalledTimes(2)
  })

  it("should refresh index on flowCreated", async () => {
    const flows = createMockFlows()
    const data = createMockData([])

    await startDispatcher(flows as any, data as any)

    const createdHandler = (flows.flowCreated as any).mock.calls[0][0] as Function
    createdHandler({ event: {} })

    expect(data.queryItems).toHaveBeenCalledTimes(2)
  })

  it("should refresh index on flowUpdated", async () => {
    const flows = createMockFlows()
    const data = createMockData([])

    await startDispatcher(flows as any, data as any)

    const updatedHandler = (flows.flowUpdated as any).mock.calls[0][0] as Function
    updatedHandler({ event: {} })

    expect(data.queryItems).toHaveBeenCalledTimes(2)
  })

  it("should refresh index on flowDeleted", async () => {
    const flows = createMockFlows()
    const data = createMockData([])

    await startDispatcher(flows as any, data as any)

    const deletedHandler = (flows.flowDeleted as any).mock.calls[0][0] as Function
    deletedHandler({ event: {} })

    expect(data.queryItems).toHaveBeenCalledTimes(2)
  })
})
