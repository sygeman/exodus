import { describe, it, expect, beforeEach } from "bun:test"
import { Evento } from "../evento"
import { z } from "zod"

describe("Evento - Source Tracking & Loop Detection", () => {
  let evento: Evento<"test">

  beforeEach(() => {
    evento = new Evento("test")
    evento.register({
      "data:create_item": { schema: z.any() },
      "data:item_created": { schema: z.any() },
      "counter:increment": { schema: z.any() },
      "counter:updated": { schema: z.any() },
      ping: { schema: z.any() },
      pong: { schema: z.any() },
      loop: { schema: z.any() },
      action: { schema: z.any() },
      a: { schema: z.any() },
      b: { schema: z.any() },
      c: { schema: z.any() },
    })
  })

  describe("source propagation", () => {
    it("should propagate source through forward chain", () => {
      const sources: Record<string, string> = {}

      evento.on("data:create_item", (ctx) => {
        sources["data:create_item"] = ctx.meta.source
        evento.forward("data:item_created", { item_id: "1" }, ctx)
      })

      evento.on("data:item_created", (ctx) => {
        sources["data:item_created"] = ctx.meta.source
      })

      evento.emitEvent("data:create_item", { title: "Elden Ring" }, "flows:run_abc123")

      expect(sources["data:create_item"]).toBe("flows:run_abc123")
      expect(sources["data:item_created"]).toBe("flows:run_abc123")
    })

    it("should keep source from original user action across multiple forwards", () => {
      const results: { name: string; source: string; depth: number }[] = []

      evento.on("counter:increment", (ctx) => {
        results.push({ name: "counter:increment", source: ctx.meta.source, depth: ctx.meta.depth })
        evento.forward("counter:updated", {}, ctx)
      })

      evento.on("counter:updated", (ctx) => {
        results.push({ name: "counter:updated", source: ctx.meta.source, depth: ctx.meta.depth })
      })

      evento.emitEvent("counter:increment", {}, "user:click_btn")

      expect(results).toHaveLength(2)
      expect(results[0].source).toBe("user:click_btn")
      expect(results[0].depth).toBe(0)
      expect(results[1].source).toBe("user:click_btn")
      expect(results[1].depth).toBe(1)
    })
  })

  describe("loop detection", () => {
    it("should detect and break infinite loops by depth limit", () => {
      const warnings: string[] = []
      const originalWarn = console.warn
      console.warn = (msg: string) => warnings.push(msg)

      const events: { name: string; depth: number }[] = []

      evento.on("ping", (ctx) => {
        events.push({ name: "ping", depth: ctx.meta.depth })
        evento.forward("pong", {}, ctx)
      })

      evento.on("pong", (ctx) => {
        events.push({ name: "pong", depth: ctx.meta.depth })
        evento.forward("ping", {}, ctx)
      })

      evento.emitEvent("ping", {}, "test:loop")

      console.warn = originalWarn

      expect(events.length).toBeLessThan(50)
      expect(warnings.some((w) => w.includes("DEPTH_EXCEEDED"))).toBe(true)
      expect(warnings.some((w) => w.includes("DEPTH_WARNING"))).toBe(true)
    })

    it("should emit evento:error when depth limit is exceeded", () => {
      const errors: { code: string; event_name: string; depth: number }[] = []

      evento.on("evento:error", (ctx) => {
        const payload = ctx.payload as any
        errors.push({
          code: payload.error.code,
          event_name: payload.error.details.event_name,
          depth: payload.error.details.depth,
        })
      })

      // Create a chain that will exceed MAX_EVENT_DEPTH
      evento.on("loop", (ctx) => {
        evento.forward("loop", {}, ctx)
      })

      evento.emitEvent("loop", {}, "test:depth")

      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0].code).toBe("DEPTH_EXCEEDED")
      expect(errors[0].event_name).toBe("loop")
      expect(errors[0].depth).toBeGreaterThanOrEqual(25)
    })

    it("should generate unique trace_id for each new emitEvent chain", () => {
      const traceIds: string[] = []

      evento.on("action", (ctx) => {
        traceIds.push(ctx.meta.trace_id)
      })

      evento.emitEvent("action", {}, "user:click_1")
      evento.emitEvent("action", {}, "user:click_2")
      evento.emitEvent("action", {}, "user:click_3")

      expect(traceIds).toHaveLength(3)
      expect(new Set(traceIds).size).toBe(3)
    })

    it("should reuse trace_id within forward chain", () => {
      const traceIds: string[] = []

      evento.on("a", (ctx) => {
        traceIds.push(ctx.meta.trace_id)
        evento.forward("b", {}, ctx)
      })

      evento.on("b", (ctx) => {
        traceIds.push(ctx.meta.trace_id)
        evento.forward("c", {}, ctx)
      })

      evento.on("c", (ctx) => {
        traceIds.push(ctx.meta.trace_id)
      })

      evento.emitEvent("a", {}, "user:click")

      expect(traceIds).toHaveLength(3)
      expect(new Set(traceIds).size).toBe(1)
    })
  })
})
