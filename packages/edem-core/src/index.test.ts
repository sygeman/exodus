import { describe, expect, it } from "bun:test"
import { Edem } from "./index"

// =============================================================================
// EDEM
// =============================================================================

describe("Edem", () => {
  it("creates instance", () => {
    const edem = new Edem("test")
    expect(edem).toBeDefined()
  })

  it("registers module", () => {
    const edem = new Edem("test")

    function testModule(edem: Edem) {
      edem.test = {
        hello: () => "world",
      }
    }

    edem.register(testModule)
    expect(edem.test.hello()).toBe("world")
  })

  it("chains registrations", () => {
    const edem = new Edem("test")
      .register((edem) => {
        edem.mod1 = { value: 1 }
      })
      .register((edem) => {
        edem.mod2 = { value: 2 }
      })

    expect(edem.mod1.value).toBe(1)
    expect(edem.mod2.value).toBe(2)
  })

  it("handles events internally", () => {
    const edem = new Edem("test")
    const received: any[] = []

    edem.on("test:event", (ctx) => {
      received.push(ctx.payload)
    })

    edem.emit("test:event", { foo: "bar" }, "test:source")

    expect(received).toHaveLength(1)
    expect(received[0]).toEqual({ foo: "bar" })
  })

  it("handles request-response", async () => {
    const edem = new Edem("test")

    edem.handle("test:query", (ctx) => {
      return { result: ctx.payload }
    })

    const result = await edem.request("test:query", { id: 123 })
    expect(result).toEqual({ result: { id: 123 } })
  })

  it("rejects on timeout", async () => {
    const edem = new Edem("test")

    await expect(edem.request("test:timeout", {}, { timeout: 50 })).rejects.toThrow("TIMEOUT")
  })
})
