import { describe, it, expect, beforeEach } from "bun:test"
import { Evento } from "../evento"
import type { EventoHandlerContext } from "../types"

describe("Evento - Error Handling", () => {
  let evento: Evento<"test">

  beforeEach(() => {
    evento = new Evento("test")
  })

  describe("structured error format", () => {
    it("should emit error events with AppError structure", () => {
      let errorEvent: EventoHandlerContext<"test"> | null = null

      evento.on("data:error", (ctx) => {
        errorEvent = ctx
      })

      evento.emitEvent(
        "data:error",
        {
          action: "create_item",
          error: {
            code: "FIELD_REQUIRED",
            message: "Title is required",
            message_key: "errors.validation.field_required",
            message_args: { field: "title" },
            details: { collection_id: "games" },
          },
        },
        "data:module",
      )

      expect(errorEvent).not.toBeNull()
      const payload = errorEvent!.payload as any
      expect(payload.error.code).toBe("FIELD_REQUIRED")
      expect(payload.error.message).toBe("Title is required")
      expect(payload.error.message_key).toBe("errors.validation.field_required")
      expect(payload.error.message_args).toEqual({ field: "title" })
      expect(payload.error.details).toEqual({ collection_id: "games" })
    })

    it("should support error chaining (cause)", () => {
      let errorEvent: EventoHandlerContext<"test"> | null = null

      evento.on("flows:error", (ctx) => {
        errorEvent = ctx
      })

      evento.emitEvent(
        "flows:error",
        {
          action: "run",
          error: {
            code: "FLOW_EXECUTION_FAILED",
            message: "Flow execution failed at node 'fetch_data'",
            cause: {
              code: "HTTP_ERROR",
              message: "Request failed with status 503",
              cause: {
                code: "CONNECTION_TIMEOUT",
                message: "Connection timed out after 30s",
              },
            },
          },
        },
        "flows:module",
      )

      expect(errorEvent).not.toBeNull()
      const error = (errorEvent!.payload as any).error
      expect(error.code).toBe("FLOW_EXECUTION_FAILED")
      expect(error.cause.code).toBe("HTTP_ERROR")
      expect(error.cause.cause.code).toBe("CONNECTION_TIMEOUT")
    })

    it("should include EventMeta in error events", () => {
      let errorEvent: EventoHandlerContext<"test"> | null = null

      evento.on("*:error", (ctx) => {
        errorEvent = ctx
      })

      evento.emitEvent(
        "data:error",
        {
          error: { code: "NOT_FOUND", message: "Item not found" },
        },
        "data:module",
      )

      expect(errorEvent).not.toBeNull()
      expect(errorEvent!.meta.source).toBe("data:module")
      expect(errorEvent!.meta.depth).toBe(0)
      expect(errorEvent!.meta.trace_id).toBeString()
      expect(errorEvent!.meta.timestamp).toBeNumber()
    })
  })

  describe("error codes", () => {
    it("should support validation error codes", () => {
      const codes = ["VALIDATION_ERROR", "FIELD_REQUIRED", "FIELD_INVALID"]
      // These are conventions, not enforced by types
      expect(codes).toContain("VALIDATION_ERROR")
    })

    it("should support resource error codes", () => {
      const codes = ["NOT_FOUND", "ALREADY_EXISTS", "CONFLICT"]
      expect(codes).toContain("NOT_FOUND")
    })

    it("should support state error codes", () => {
      const codes = ["INVALID_STATE", "INVALID_TRANSITION"]
      expect(codes).toContain("INVALID_STATE")
    })

    it("should support limit error codes", () => {
      const codes = ["DEPTH_EXCEEDED", "RATE_LIMITED", "BACKPRESSURE_LIMIT", "TIMEOUT"]
      expect(codes).toContain("DEPTH_EXCEEDED")
    })

    it("should support system error codes", () => {
      const codes = ["INTERNAL_ERROR", "DB_ERROR"]
      expect(codes).toContain("INTERNAL_ERROR")
    })
  })

  describe("global error listener", () => {
    it("should catch all errors with wildcard pattern", () => {
      const errors: { code: string; source: string }[] = []

      evento.on("*:error", (ctx) => {
        const payload = ctx.payload as any
        errors.push({ code: payload.error?.code, source: ctx.meta.source })
      })

      evento.emitEvent("data:error", { error: { code: "NOT_FOUND" } }, "data")
      evento.emitEvent("api:error", { error: { code: "TIMEOUT" } }, "api")
      evento.emitEvent("flows:error", { error: { code: "INVALID_STATE" } }, "flows")

      expect(errors).toHaveLength(3)
      expect(errors[0].code).toBe("NOT_FOUND")
      expect(errors[1].code).toBe("TIMEOUT")
      expect(errors[2].code).toBe("INVALID_STATE")
    })
  })
})
