import { describe, it, expect, beforeEach } from "bun:test"
import { Evento } from "../evento"
import type { EventoHandlerContext } from "../types"

describe("Evento - Payload Schema", () => {
  let evento: Evento<"test">

  beforeEach(() => {
    evento = new Evento("test")
  })

  describe("emitEvent", () => {
    it("should merge payload with auto-generated EventMeta", () => {
      let ctx: EventoHandlerContext<"test"> | null = null
      evento.on("counter:increment", (c) => {
        ctx = c
      })

      evento.emitEvent("counter:increment", { count: 5 }, "user:click_btn_increment")

      expect(ctx).not.toBeNull()
      expect(ctx!.name).toBe("counter:increment")
      expect((ctx!.payload as any).count).toBe(5)
      expect(ctx!.meta.source).toBe("user:click_btn_increment")
      expect(ctx!.meta.depth).toBe(0)
      expect(ctx!.meta.trace_id).toBeString()
      expect(ctx!.meta.timestamp).toBeNumber()
    })

    it("should emit void event with EventMeta only", () => {
      let ctx: EventoHandlerContext<"test"> | null = null
      evento.on("timer:tick", (c) => {
        ctx = c
      })

      ;(evento as any).emitEvent("timer:tick", "system:timer_001")

      expect(ctx).not.toBeNull()
      expect(ctx!.meta.source).toBe("system:timer_001")
      expect(ctx!.meta.depth).toBe(0)
      expect(ctx!.meta.trace_id).toBeString()
      expect(ctx!.meta.timestamp).toBeNumber()
    })

    it("should send full payload through sender", () => {
      let sent: { name: string; payload: unknown; meta: any } | null = null
      evento.sender = (data) => {
        sent = data
      }

      evento.emitEvent("test:event", { value: 42 }, "user:click")

      expect(sent).not.toBeNull()
      expect(sent!.name).toBe("test:event")
      expect((sent!.payload as any).value).toBe(42)
      expect(sent!.meta.source).toBe("user:click")
      expect(sent!.meta.depth).toBe(0)
      expect(sent!.meta.trace_id).toBeString()
      expect(sent!.meta.timestamp).toBeNumber()
    })
  })

  describe("forward", () => {
    it("should preserve source and trace_id and increment depth", () => {
      let ctx: EventoHandlerContext<"test"> | null = null
      evento.on("counter:updated", (c) => {
        ctx = c
      })

      const handlerContext: EventoHandlerContext<"test"> = {
        name: "counter:increment",
        payload: {},
        meta: {
          environment: "test",
          source: "user:click_btn_increment",
          depth: 0,
          trace_id: "trace-abc-123",
          timestamp: 1705123456789,
        },
        segments: ["counter", "increment"],
      }

      evento.forward("counter:updated", { count: 1 }, handlerContext)

      expect(ctx).not.toBeNull()
      expect((ctx!.payload as any).count).toBe(1)
      expect(ctx!.meta.source).toBe("user:click_btn_increment")
      expect(ctx!.meta.depth).toBe(1)
      expect(ctx!.meta.trace_id).toBe("trace-abc-123")
      expect(ctx!.meta.timestamp).toBeGreaterThanOrEqual(1705123456789)
    })

    it("should forward void event", () => {
      let ctx: EventoHandlerContext<"test"> | null = null
      evento.on("counter:reset", (c) => {
        ctx = c
      })

      const handlerContext: EventoHandlerContext<"test"> = {
        name: "counter:updated",
        payload: {},
        meta: {
          environment: "test",
          source: "system:auto",
          depth: 2,
          trace_id: "trace-xyz",
          timestamp: Date.now(),
        },
        segments: ["counter", "updated"],
      }

      ;(evento as any).forward("counter:reset", handlerContext)

      expect(ctx).not.toBeNull()
      expect(ctx!.meta.source).toBe("system:auto")
      expect(ctx!.meta.depth).toBe(3)
      expect(ctx!.meta.trace_id).toBe("trace-xyz")
    })

    it("should chain multiple forwards with increasing depth", () => {
      const events: { name: string; depth: number; trace_id: string }[] = []

      evento.on("step1", (ctx) => {
        events.push({
          name: "step1",
          depth: ctx.meta.depth,
          trace_id: ctx.meta.trace_id,
        })
        evento.forward("step2", { data: 2 }, ctx)
      })

      evento.on("step2", (ctx) => {
        events.push({
          name: "step2",
          depth: ctx.meta.depth,
          trace_id: ctx.meta.trace_id,
        })
        evento.forward("step3", { data: 3 }, ctx)
      })

      evento.on("step3", (ctx) => {
        events.push({
          name: "step3",
          depth: ctx.meta.depth,
          trace_id: ctx.meta.trace_id,
        })
      })

      evento.emitEvent("step1", { data: 1 }, "user:action")

      expect(events).toHaveLength(3)
      expect(events[0].depth).toBe(0)
      expect(events[1].depth).toBe(1)
      expect(events[2].depth).toBe(2)
      expect(events[0].trace_id).toBe(events[1].trace_id)
      expect(events[1].trace_id).toBe(events[2].trace_id)
    })
  })

  describe("emitLocal", () => {
    it("should fill in missing meta fields with defaults", () => {
      let ctx: EventoHandlerContext<"test"> | null = null
      evento.on("test:event", (c) => {
        ctx = c
      })

      evento.emitLocal("test:event", { value: 42 }, { source: "partial:meta" })

      expect(ctx).not.toBeNull()
      expect((ctx!.payload as any).value).toBe(42)
      expect(ctx!.meta.source).toBe("partial:meta")
      expect(ctx!.meta.environment).toBe("test")
      expect(ctx!.meta.depth).toBe(0)
      expect(ctx!.meta.trace_id).toBeString()
      expect(ctx!.meta.timestamp).toBeNumber()
    })

    it("should preserve provided meta fields", () => {
      let ctx: EventoHandlerContext<"test"> | null = null
      evento.on("test:event", (c) => {
        ctx = c
      })

      evento.emitLocal(
        "test:event",
        { value: 42 },
        {
          environment: "webview" as any,
          source: "rpc:adapter",
          depth: 5,
          trace_id: "trace-abc-123",
          timestamp: 1705123456789,
        },
      )

      expect(ctx).not.toBeNull()
      expect(ctx!.meta.environment).toBe("webview" as any)
      expect(ctx!.meta.source).toBe("rpc:adapter")
      expect(ctx!.meta.depth).toBe(5)
      expect(ctx!.meta.trace_id).toBe("trace-abc-123")
      expect(ctx!.meta.timestamp).toBe(1705123456789)
    })
  })
})
