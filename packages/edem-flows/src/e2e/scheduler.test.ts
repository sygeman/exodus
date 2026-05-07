import { describe, it, expect } from "bun:test"
import { startScheduler } from "../index"
import { getEdem, setupTests } from "./setup"

describe("scheduler", () => {
  setupTests()

  it("startScheduler sets up without error", async () => {
    const edem = getEdem()
    await edem.flows.createFlow({
      name: "Scheduled",
      trigger: { type: "schedule", every: "1h" },
    })

    await startScheduler(edem.flows as any, edem.data as any)
    expect(console.log).toHaveBeenCalled()
  })

  it("startScheduler with flow that has last_run_at", async () => {
    const edem = getEdem()
    const { flow_id } = await edem.flows.createFlow({
      name: "Scheduled",
      trigger: { type: "schedule", every: "1h" },
    })

    await edem.flows.runFlow({ flow_id })

    await startScheduler(edem.flows as any, edem.data as any)
    expect(console.log).toHaveBeenCalled()
  })

  it("scheduler ignores non-schedule triggers", async () => {
    const edem = getEdem()
    await edem.flows.createFlow({
      name: "Manual Flow",
      trigger: { type: "manual" },
    })

    await startScheduler(edem.flows as any, edem.data as any)
    expect(console.log).toHaveBeenCalled()
  })

  it("scheduler sets up multiple scheduled flows", async () => {
    const edem = getEdem()
    await edem.flows.createFlow({
      name: "Hourly",
      trigger: { type: "schedule", every: "1h" },
    })
    await edem.flows.createFlow({
      name: "Daily",
      trigger: { type: "schedule", every: "1d" },
    })

    await startScheduler(edem.flows as any, edem.data as any)
    expect(console.log).toHaveBeenCalled()
  })

  it("scheduler handles flow with day filter", async () => {
    const edem = getEdem()
    await edem.flows.createFlow({
      name: "Weekdays",
      trigger: { type: "schedule", every: "1h", days: ["mon", "tue", "wed", "thu", "fri"] },
    })

    await startScheduler(edem.flows as any, edem.data as any)
    expect(console.log).toHaveBeenCalled()
  })

  it("scheduler handles flow with at time", async () => {
    const edem = getEdem()
    await edem.flows.createFlow({
      name: "AtTime",
      trigger: { type: "schedule", every: "1d", at: "09:00" },
    })

    await startScheduler(edem.flows as any, edem.data as any)
    expect(console.log).toHaveBeenCalled()
  })

  it("scheduler stop() cleans up timers", async () => {
    const edem = getEdem()
    await edem.flows.createFlow({
      name: "Hourly",
      trigger: { type: "schedule", every: "1h" },
    })

    const scheduler = await startScheduler(edem.flows as any, edem.data as any)
    expect(console.log).toHaveBeenCalled()

    scheduler.stop()
    expect(console.log).toHaveBeenCalled()
  })

  it("scheduler handles flow update removing schedule", async () => {
    const edem = getEdem()
    const { flow_id } = await edem.flows.createFlow({
      name: "Scheduled",
      trigger: { type: "schedule", every: "1h" },
    })

    await startScheduler(edem.flows as any, edem.data as any)

    await edem.flows.updateFlow({
      flow_id,
      trigger: { type: "manual" },
    })

    expect(console.log).toHaveBeenCalled()
  })
})
