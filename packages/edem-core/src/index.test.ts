import { describe, expect, it } from "bun:test"
import {
  Core,
  EventoBun,
  checkDepth,
  createEventMeta,
  createTraceId,
  nextDepth,
  type EventContext,
  type Module,
} from "./index"

// =============================================================================
// TRACING UTILITIES
// =============================================================================

describe("createTraceId", () => {
  it("generates a valid UUID", () => {
    const id = createTraceId()
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  })

  it("generates unique IDs", () => {
    const id1 = createTraceId()
    const id2 = createTraceId()
    expect(id1).not.toBe(id2)
  })
})

describe("createEventMeta", () => {
  it("creates meta with depth 0", () => {
    const meta = createEventMeta("user:click")
    expect(meta.source).toBe("user:click")
    expect(meta.depth).toBe(0)
    expect(meta.trace_id).toMatch(/^[0-9a-f-]{36}$/i)
    expect(meta.timestamp).toBeGreaterThan(0)
  })
})

describe("nextDepth", () => {
  it("increments depth", () => {
    const meta = createEventMeta("user:click")
    const next = nextDepth(meta)
    expect(next.depth).toBe(1)
    expect(next.source).toBe(meta.source)
    expect(next.trace_id).toBe(meta.trace_id)
    expect(next.timestamp).toBeGreaterThanOrEqual(meta.timestamp)
  })
})

// =============================================================================
// LOOP DETECTION
// =============================================================================

describe("checkDepth", () => {
  it("allows depth below warning threshold", () => {
    expect(checkDepth(0)).toEqual({ ok: true })
    expect(checkDepth(10)).toEqual({ ok: true })
    expect(checkDepth(19)).toEqual({ ok: true })
  })

  it("warns at warning threshold", () => {
    expect(checkDepth(20)).toEqual({ ok: true, warning: true })
    expect(checkDepth(24)).toEqual({ ok: true, warning: true })
  })

  it("rejects at max depth", () => {
    expect(checkDepth(25)).toEqual({ ok: false })
    expect(checkDepth(100)).toEqual({ ok: false })
  })
})

// =============================================================================
// EVENTO BUN
// =============================================================================

describe("EventoBun", () => {
  it("emits and receives events", () => {
    const evento = new EventoBun()
    const received: EventContext[] = []

    const unsubscribe = evento.on("test:event", (ctx) => {
      received.push(ctx)
    })

    evento.emit("test:event", { foo: "bar" }, { source: "test:1" })

    expect(received).toHaveLength(1)
    expect(received[0].type).toBe("test:event")
    expect(received[0].payload).toEqual({ foo: "bar" })
    expect(received[0].meta.source).toBe("test:1")
    expect(received[0].meta.depth).toBe(0)

    unsubscribe()
  })

  it("unsubscribes correctly", () => {
    const evento = new EventoBun()
    const received: EventContext[] = []

    const unsubscribe = evento.on("test:event", (ctx) => {
      received.push(ctx)
    })

    unsubscribe()
    evento.emit("test:event", { foo: "bar" })

    expect(received).toHaveLength(0)
  })

  it("handles multiple listeners", () => {
    const evento = new EventoBun()
    const received1: EventContext[] = []
    const received2: EventContext[] = []

    evento.on("test:event", (ctx) => received1.push(ctx))
    evento.on("test:event", (ctx) => received2.push(ctx))

    evento.emit("test:event", { foo: "bar" })

    expect(received1).toHaveLength(1)
    expect(received2).toHaveLength(1)
  })

  it("handles request-response", async () => {
    const evento = new EventoBun()

    evento.handle("test:query", (ctx) => {
      return { result: ctx.payload }
    })

    const result = await evento.request("test:query", { id: 123 })
    expect(result).toEqual({ result: { id: 123 } })
  })

  it("handles async request handlers", async () => {
    const evento = new EventoBun()

    evento.handle("test:async", async (ctx) => {
      await new Promise((resolve) => setTimeout(resolve, 10))
      return { async: true, payload: ctx.payload }
    })

    const result = await evento.request("test:async", { id: 1 })
    expect(result).toEqual({ async: true, payload: { id: 1 } })
  })

  it("rejects on timeout", async () => {
    const evento = new EventoBun()
    // No handler registered

    await expect(evento.request("test:timeout", {}, undefined, 50)).rejects.toThrow(
      "Request timeout",
    )
  })

  it("increments depth on emit", () => {
    const evento = new EventoBun()
    const depths: number[] = []

    evento.on("test:chain", (ctx) => {
      depths.push(ctx.meta.depth)
      if (ctx.meta.depth < 3) {
        evento.emit("test:chain", {}, nextDepth(ctx.meta))
      }
    })

    evento.emit("test:chain", {}, { source: "test:1", depth: 0, trace_id: createTraceId() })

    expect(depths).toEqual([0, 1, 2, 3])
  })

  it("rejects events exceeding max depth", () => {
    const evento = new EventoBun()
    const received: EventContext[] = []

    evento.on("test:deep", (ctx) => {
      received.push(ctx)
    })

    evento.emit("test:deep", {}, { source: "test:1", depth: 25, trace_id: createTraceId() })

    expect(received).toHaveLength(0)
  })
})

// =============================================================================
// CORE
// =============================================================================

describe("Core", () => {
  it("registers and initializes modules", async () => {
    const core = new Core()
    const initialized: string[] = []

    const module: Module = {
      name: "test",
      init: () => {
        initialized.push("test")
      },
    }

    core.register(module)
    await core.init()

    expect(initialized).toEqual(["test"])
    expect(core.getModuleNames()).toEqual(["test"])
  })

  it("initializes modules in order", async () => {
    const core = new Core()
    const order: string[] = []

    core.register({
      name: "first",
      init: () => {
        order.push("first")
      },
    })

    core.register({
      name: "second",
      init: () => {
        order.push("second")
      },
    })

    await core.init()
    expect(order).toEqual(["first", "second"])
  })

  it("passes Evento to modules", async () => {
    const core = new Core()
    let receivedEvento: Evento | null = null

    core.register({
      name: "test",
      init: (evento) => {
        receivedEvento = evento
      },
    })

    await core.init()
    expect(receivedEvento).toBe(core.getEvento())
  })

  it("throws on duplicate module name", () => {
    const core = new Core()

    core.register({ name: "test", init: () => {} })
    expect(() => core.register({ name: "test", init: () => {} })).toThrow(
      'Module "test" already registered',
    )
  })

  it("throws on register after init", async () => {
    const core = new Core()

    core.register({ name: "test", init: () => {} })
    await core.init()

    expect(() => core.register({ name: "late", init: () => {} })).toThrow("Cannot register module")
  })

  it("throws on double init", async () => {
    const core = new Core()
    core.register({ name: "test", init: () => {} })
    await core.init()

    await expect(core.init()).rejects.toThrow("Already initialized")
  })

  it("modules can communicate via Evento", async () => {
    const core = new Core()
    const received: unknown[] = []

    core.register({
      name: "publisher",
      init: (evento) => {
        evento.on("test:msg", (ctx) => {
          received.push(ctx.payload)
        })
      },
    })

    core.register({
      name: "subscriber",
      init: (evento) => {
        evento.emit("test:msg", { hello: "world" })
      },
    })

    await core.init()
    expect(received).toEqual([{ hello: "world" }])
  })
})
