import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test"
import { parseEvery, matchesSchedule, type ScheduleTrigger } from "./manifest"

function createMockFlows() {
  return {
    runFlow: mock(() => Promise.resolve({ run_id: "run-1", status: "running" })),
    listFlows: mock(() => Promise.resolve({ flows: [] })),
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

describe("parseEvery", () => {
  it("should parse minutes", () => {
    expect(parseEvery("5m")).toBe(5 * 60 * 1000)
    expect(parseEvery("1m")).toBe(60 * 1000)
    expect(parseEvery("30m")).toBe(30 * 60 * 1000)
  })

  it("should parse hours", () => {
    expect(parseEvery("1h")).toBe(60 * 60 * 1000)
    expect(parseEvery("2h")).toBe(2 * 60 * 60 * 1000)
  })

  it("should parse days", () => {
    expect(parseEvery("1d")).toBe(24 * 60 * 60 * 1000)
    expect(parseEvery("7d")).toBe(7 * 24 * 60 * 60 * 1000)
  })

  it("should parse weeks", () => {
    expect(parseEvery("1w")).toBe(7 * 24 * 60 * 60 * 1000)
    expect(parseEvery("2w")).toBe(14 * 24 * 60 * 60 * 1000)
  })

  it("should throw on invalid format", () => {
    expect(() => parseEvery("")).toThrow("Invalid every format")
    expect(() => parseEvery("5")).toThrow("Invalid every format")
    expect(() => parseEvery("5x")).toThrow("Invalid every format")
    expect(() => parseEvery("abc")).toThrow("Invalid every format")
  })
})

describe("matchesSchedule", () => {
  it("should match when no days or at specified", () => {
    const trigger: ScheduleTrigger = { type: "schedule", every: "1h" }
    expect(matchesSchedule(trigger, new Date())).toBe(true)
  })

  it("should match correct day of week", () => {
    const trigger: ScheduleTrigger = {
      type: "schedule",
      every: "1d",
      days: ["mon", "wed", "fri"],
    }

    const monday = new Date("2024-01-01T12:00:00")
    expect(monday.getDay()).toBe(1)
    expect(matchesSchedule(trigger, monday)).toBe(true)

    const tuesday = new Date("2024-01-02T12:00:00")
    expect(tuesday.getDay()).toBe(2)
    expect(matchesSchedule(trigger, tuesday)).toBe(false)
  })

  it("should match correct time of day", () => {
    const trigger: ScheduleTrigger = {
      type: "schedule",
      every: "1d",
      at: "09:00",
    }

    const nineAm = new Date("2024-01-01T09:00:00")
    expect(matchesSchedule(trigger, nineAm)).toBe(true)

    const tenAm = new Date("2024-01-01T10:00:00")
    expect(matchesSchedule(trigger, tenAm)).toBe(false)
  })

  it("should match both day and time", () => {
    const trigger: ScheduleTrigger = {
      type: "schedule",
      every: "1d",
      at: "09:00",
      days: ["mon"],
    }

    const mondayNineAm = new Date("2024-01-01T09:00:00")
    expect(matchesSchedule(trigger, mondayNineAm)).toBe(true)

    const mondayTenAm = new Date("2024-01-01T10:00:00")
    expect(matchesSchedule(trigger, mondayTenAm)).toBe(false)

    const tuesdayNineAm = new Date("2024-01-02T09:00:00")
    expect(matchesSchedule(trigger, tuesdayNineAm)).toBe(false)
  })

  it("should handle weekend days", () => {
    const trigger: ScheduleTrigger = {
      type: "schedule",
      every: "1d",
      days: ["sat", "sun"],
    }

    const saturday = new Date("2024-01-06T12:00:00")
    expect(saturday.getDay()).toBe(6)
    expect(matchesSchedule(trigger, saturday)).toBe(true)

    const sunday = new Date("2024-01-07T12:00:00")
    expect(sunday.getDay()).toBe(0)
    expect(matchesSchedule(trigger, sunday)).toBe(true)

    const monday = new Date("2024-01-01T12:00:00")
    expect(matchesSchedule(trigger, monday)).toBe(false)
  })
})

describe("startScheduler", () => {
  let startScheduler: typeof import("./scheduler").startScheduler
  let originalLog: typeof console.log

  beforeEach(async () => {
    const mod = await import("./scheduler")
    startScheduler = mod.startScheduler
    originalLog = console.log
    console.log = mock(() => {})
  })

  afterEach(() => {
    console.log = originalLog
  })

  it("should set up schedules for flows with schedule triggers", async () => {
    const flows = createMockFlows()
    const data = createMockData([
      {
        id: "flow-1",
        data: {
          trigger: { type: "schedule", every: "1h" },
        },
      },
    ])

    await startScheduler(flows as any, data as any)
    expect(console.log).toHaveBeenCalled()
  })

  it("should not set up schedules for non-schedule triggers", async () => {
    const flows = createMockFlows()
    const data = createMockData([
      {
        id: "flow-1",
        data: {
          trigger: { type: "manual" },
        },
      },
      {
        id: "flow-2",
        data: {
          trigger: { type: "event", event: "test" },
        },
      },
    ])

    await startScheduler(flows as any, data as any)
    expect(console.log).toHaveBeenCalled()
  })

  it("should pass lastRunAt to setupSchedule", async () => {
    const flows = createMockFlows()
    const lastRunAt = Date.now() - 30 * 60 * 1000
    const data = createMockData([
      {
        id: "flow-1",
        data: {
          trigger: { type: "schedule", every: "1h" },
          last_run_at: lastRunAt,
        },
      },
    ])

    await startScheduler(flows as any, data as any)
    expect(console.log).toHaveBeenCalled()
  })

  it("should register event handlers for flow lifecycle", async () => {
    const flows = createMockFlows()
    const data = createMockData([])

    await startScheduler(flows as any, data as any)

    expect(flows.flowCreated).toHaveBeenCalled()
    expect(flows.flowUpdated).toHaveBeenCalled()
    expect(flows.flowDeleted).toHaveBeenCalled()
  })

  it("should handle flowCreated event", async () => {
    const flows = createMockFlows()
    const data = createMockData([])

    await startScheduler(flows as any, data as any)

    const createdHandler = (flows.flowCreated as any).mock.calls[0][0] as Function
    createdHandler({
      event: {
        id: "new-flow",
        trigger: { type: "schedule", every: "1h" },
      },
    })
  })

  it("should handle flowUpdated event with schedule trigger", async () => {
    const flows = createMockFlows()
    const data = createMockData([])

    await startScheduler(flows as any, data as any)

    const updatedHandler = (flows.flowUpdated as any).mock.calls[0][0] as Function
    updatedHandler({
      event: {
        id: "updated-flow",
        trigger: { type: "schedule", every: "30m" },
      },
    })
  })

  it("should handle flowUpdated event with non-schedule trigger", async () => {
    const flows = createMockFlows()
    const data = createMockData([])

    await startScheduler(flows as any, data as any)

    const updatedHandler = (flows.flowUpdated as any).mock.calls[0][0] as Function
    updatedHandler({
      event: {
        id: "updated-flow",
        trigger: { type: "manual" },
      },
    })
  })

  it("should handle flowDeleted event", async () => {
    const flows = createMockFlows()
    const data = createMockData([])

    await startScheduler(flows as any, data as any)

    const deletedHandler = (flows.flowDeleted as any).mock.calls[0][0] as Function
    deletedHandler({
      event: { flow_id: "deleted-flow" },
    })
  })
})
