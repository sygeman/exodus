import { describe, it, expect, beforeEach } from "bun:test"
import { Evento } from "../evento"
import type { EventoHandler, EventoHandlerContext } from "../types"

describe("Evento", () => {
  let evento: Evento<"test">

  beforeEach(() => {
    evento = new Evento("test")
  })

  const emit = (name: string, payload?: unknown) => {
    ;(evento as any)._emitLocal(name, payload, { environment: "test" })
  }

  describe("on", () => {
    it("should subscribe to exact event", () => {
      const handler = ({ name }: EventoHandlerContext<"test">) => {
        expect(name).toBe("user:login")
      }
      evento.on("user:login", handler as EventoHandler)
      emit("user:login")
    })

    it("should call handler with context", () => {
      let receivedContext: EventoHandlerContext<"test"> | null = null
      const handler = (ctx: EventoHandlerContext<"test">) => {
        receivedContext = ctx
      }
      evento.on("user:login", handler as EventoHandler)
      emit("user:login", { userId: 123 })

      expect(receivedContext).not.toBeNull()
      expect(receivedContext!.name).toBe("user:login")
      expect((receivedContext!.payload as any).userId).toBe(123)
      expect(receivedContext!.segments).toEqual(["user", "login"])
      expect(receivedContext!.meta.environment).toBe("test")
    })

    it("should support multiple handlers for same event", () => {
      let count = 0
      evento.on("user:login", () => count++)
      evento.on("user:login", () => count++)
      emit("user:login")
      expect(count).toBe(2)
    })

    it("should support wildcard patterns", () => {
      let called = false
      evento.on("user:*", () => {
        called = true
      })
      emit("user:login")
      expect(called).toBe(true)
    })

    it("should return unsubscribe function", () => {
      let count = 0
      const unsubscribe = evento.on("user:login", () => count++)

      emit("user:login")
      expect(count).toBe(1)

      unsubscribe()
      emit("user:login")
      expect(count).toBe(1)
    })
  })

  describe("once", () => {
    it("should call handler only once", () => {
      let count = 0
      evento.once("user:login", () => count++)

      emit("user:login")
      expect(count).toBe(1)

      emit("user:login")
      expect(count).toBe(1)
    })

    it("should work with wildcards", () => {
      let count = 0
      evento.once("user:*", () => count++)

      emit("user:login")
      expect(count).toBe(1)

      emit("user:logout")
      expect(count).toBe(1)
    })

    it("should return unsubscribe function", () => {
      let count = 0
      const unsubscribe = evento.once("user:login", () => count++)

      unsubscribe()
      emit("user:login")
      expect(count).toBe(0)
    })
  })

  describe("off", () => {
    it("should unsubscribe handler from exact event", () => {
      let count = 0
      const handler = () => count++

      evento.on("user:login", handler)
      emit("user:login")
      expect(count).toBe(1)

      evento.off(handler)
      emit("user:login")
      expect(count).toBe(1)
    })

    it("should unsubscribe handler from wildcard", () => {
      let count = 0
      const handler = () => count++

      evento.on("user:*", handler)
      emit("user:login")
      expect(count).toBe(1)

      evento.off(handler)
      emit("user:logout")
      expect(count).toBe(1)
    })

    it("should unsubscribe handler from multiple subscriptions", () => {
      let count = 0
      const handler = () => count++

      evento.on("user:login", handler)
      evento.on("user:*", handler)
      emit("user:login")
      expect(count).toBe(2)

      evento.off(handler)
      emit("user:login")
      expect(count).toBe(2)
    })
  })

  describe("offAll", () => {
    it("should remove all handlers for exact event", () => {
      let count = 0
      evento.on("user:login", () => count++)
      evento.on("user:login", () => count++)

      evento.offAll("user:login")
      emit("user:login")
      expect(count).toBe(0)
    })

    it("should remove all handlers for wildcard pattern", () => {
      let count = 0
      evento.on("user:*", () => count++)
      evento.on("user:*", () => count++)

      evento.offAll("user:*")
      emit("user:login")
      expect(count).toBe(0)
    })

    it("should remove all handlers when called without args", () => {
      let count = 0
      evento.on("user:login", () => count++)
      evento.on("user:*", () => count++)

      evento.offAll()
      emit("user:login")
      expect(count).toBe(0)
    })
  })

  describe("emitLocal", () => {
    it("should call matching handlers", () => {
      let loginCalled = false
      let logoutCalled = false

      evento.on("user:login", () => (loginCalled = true))
      evento.on("user:logout", () => (logoutCalled = true))

      evento.emitLocal("user:login", {}, { environment: "webview" } as any)
      expect(loginCalled).toBe(true)
      expect(logoutCalled).toBe(false)
    })

    it("should pass payload to handlers", () => {
      let receivedPayload: unknown
      evento.on("user:login", ({ payload }) => {
        receivedPayload = payload
      })

      evento.emitLocal("user:login", { userId: 42 }, { environment: "webview" } as any)
      expect((receivedPayload as any).userId).toBe(42)
    })

    it("should call wildcard handlers", () => {
      let exactCalled = false
      let wildcardCalled = false

      evento.on("user:login", () => (exactCalled = true))
      evento.on("user:*", () => (wildcardCalled = true))

      evento.emitLocal("user:login", {}, { environment: "webview" } as any)
      expect(exactCalled).toBe(true)
      expect(wildcardCalled).toBe(true)
    })

    it("should call ** handlers for all events", () => {
      let count = 0
      evento.on("**", () => count++)

      evento.emitLocal("user:login", {}, { environment: "webview" } as any)
      evento.emitLocal("user:logout", {}, { environment: "webview" } as any)
      evento.emitLocal("settings:update", {}, { environment: "webview" } as any)
      expect(count).toBe(3)
    })
  })

  describe("wildcard patterns", () => {
    it("user:* should match user:login but not user:profile:update", () => {
      let count = 0
      evento.on("user:*", () => count++)

      emit("user:login")
      expect(count).toBe(1)

      emit("user:profile:update")
      expect(count).toBe(1)
    })

    it("user:** should match any user events", () => {
      let count = 0
      evento.on("user:**", () => count++)

      emit("user:login")
      emit("user:profile:update")
      emit("user:settings:theme:change")
      expect(count).toBe(3)
    })

    it("*:update should match any update event", () => {
      let count = 0
      evento.on("*:update", () => count++)

      emit("user:update")
      emit("settings:update")
      emit("user:profile:update")
      expect(count).toBe(2)
    })

    it("**:*:error should match errors at any depth", () => {
      let count = 0
      evento.on("**:*:error", () => count++)

      emit("api:error")
      emit("api:user:error")
      emit("api:v1:user:error")
      expect(count).toBe(1)
    })
  })

  describe("emitEvent", () => {
    it("should emit event with EventMeta", () => {
      let receivedContext: EventoHandlerContext<"test"> | null = null
      const handler = (ctx: EventoHandlerContext<"test">) => {
        receivedContext = ctx
      }
      evento.on("counter:increment", handler as EventoHandler)

      evento.emitEvent("counter:increment", { count: 5 }, "user:click_btn_increment")

      expect(receivedContext).not.toBeNull()
      expect(receivedContext!.name).toBe("counter:increment")
      expect((receivedContext!.payload as any).count).toBe(5)
      expect(receivedContext!.meta.source).toBe("user:click_btn_increment")
      expect(receivedContext!.meta.depth).toBe(0)
      expect(receivedContext!.meta.trace_id).toBeString()
      expect(receivedContext!.meta.timestamp).toBeNumber()
    })

    it("should emit void event with EventMeta only", () => {
      let receivedContext: EventoHandlerContext<"test"> | null = null
      const handler = (ctx: EventoHandlerContext<"test">) => {
        receivedContext = ctx
      }
      evento.on("timer:tick", handler as EventoHandler)

      ;(evento as any).emitEvent("timer:tick", "system:timer_001")

      expect(receivedContext).not.toBeNull()
      expect(receivedContext!.meta.source).toBe("system:timer_001")
      expect(receivedContext!.meta.depth).toBe(0)
      expect(receivedContext!.meta.trace_id).toBeString()
      expect(receivedContext!.meta.timestamp).toBeNumber()
    })

    it("should send through sender with full payload", () => {
      let sentData: { name: string; payload: unknown; meta: any } | null = null
      evento.sender = (data) => {
        sentData = data
      }

      evento.emitEvent("test:event", { value: 42 }, "user:click")

      expect(sentData).not.toBeNull()
      expect(sentData!.name).toBe("test:event")
      expect((sentData!.payload as any).value).toBe(42)
      expect(sentData!.meta.source).toBe("user:click")
      expect(sentData!.meta.depth).toBe(0)
      expect(sentData!.meta.trace_id).toBeString()
    })
  })

  describe("forward", () => {
    it("should forward event with incremented depth", () => {
      let receivedContext: EventoHandlerContext<"test"> | null = null
      evento.on("counter:updated", (ctx) => {
        receivedContext = ctx
      })

      // Then forward from handler context
      const handlerContext: EventoHandlerContext<"test"> = {
        name: "counter:increment",
        payload: {},
        meta: {
          environment: "test",
          source: "user:click_btn_increment",
          depth: 0,
          trace_id: "550e8400-e29b-41d4-a716-446655440000",
          timestamp: 1705123456789,
        },
        segments: ["counter", "increment"],
      }

      evento.forward("counter:updated", { count: 1 }, handlerContext)

      expect(receivedContext).not.toBeNull()
      expect((receivedContext!.payload as any).count).toBe(1)
      expect(receivedContext!.meta.source).toBe("user:click_btn_increment")
      expect(receivedContext!.meta.depth).toBe(1) // incremented
      expect(receivedContext!.meta.trace_id).toBe("550e8400-e29b-41d4-a716-446655440000")
      expect(receivedContext!.meta.timestamp).toBeGreaterThanOrEqual(1705123456789)
    })

    it("should forward void event", () => {
      let receivedContext: EventoHandlerContext<"test"> | null = null
      evento.on("counter:reset", (ctx) => {
        receivedContext = ctx
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

      expect(receivedContext).not.toBeNull()
      expect(receivedContext!.meta.source).toBe("system:auto")
      expect(receivedContext!.meta.depth).toBe(3) // incremented
      expect(receivedContext!.meta.trace_id).toBe("trace-xyz")
    })

    it("should chain multiple forwards", () => {
      const events: { name: string; depth: number }[] = []

      evento.on("step1", (ctx) => {
        events.push({ name: "step1", depth: ctx.meta.depth })
        evento.forward("step2", { data: 2 }, ctx)
      })

      evento.on("step2", (ctx) => {
        events.push({ name: "step2", depth: ctx.meta.depth })
        evento.forward("step3", { data: 3 }, ctx)
      })

      evento.on("step3", (ctx) => {
        events.push({ name: "step3", depth: ctx.meta.depth })
      })

      evento.emitEvent("step1", { data: 1 }, "user:action")

      expect(events).toHaveLength(3)
      expect(events[0].depth).toBe(0)
      expect(events[1].depth).toBe(1)
      expect(events[2].depth).toBe(2)
    })
  })

  describe("hasListeners", () => {
    it("should return true for exact match subscriptions", () => {
      evento.on("user:login", () => {})
      expect(evento.hasListeners("user:login")).toBe(true)
    })

    it("should return true for wildcard subscriptions", () => {
      evento.on("user:*", () => {})
      expect(evento.hasListeners("user:login")).toBe(true)
    })

    it("should return false for unsubscribed events", () => {
      evento.on("user:login", () => {})
      evento.offAll("user:login")
      expect(evento.hasListeners("user:login")).toBe(false)
    })

    it("should return false for unknown events", () => {
      expect(evento.hasListeners("unknown:event")).toBe(false)
    })

    it("should return false for empty or invalid names", () => {
      expect(evento.hasListeners("")).toBe(false)
      expect(evento.hasListeners(null as any)).toBe(false)
      expect(evento.hasListeners(undefined as any)).toBe(false)
    })
  })

  describe("handler error handling", () => {
    it("should emit evento:error when handler throws", () => {
      let errorEvent: EventoHandlerContext<"test"> | null = null

      evento.on("evento:error", (ctx) => {
        errorEvent = ctx
      })

      evento.on("user:login", () => {
        throw new Error("Handler failed")
      })

      evento.emitLocal("user:login", {}, { environment: "test" } as any)

      expect(errorEvent).not.toBeNull()
      const payload = errorEvent!.payload as any
      expect(payload.error.code).toBe("HANDLER_ERROR")
      expect(payload.error.message).toBe("Handler failed")
      expect(payload.error.details.event_name).toBe("user:login")
    })

    it("should continue processing other handlers after one throws", () => {
      let secondHandlerCalled = false

      evento.on("user:login", () => {
        throw new Error("First handler failed")
      })
      evento.on("user:login", () => {
        secondHandlerCalled = true
      })

      evento.emitLocal("user:login", {}, { environment: "test" } as any)

      expect(secondHandlerCalled).toBe(true)
    })
  })
})
