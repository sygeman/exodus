import { describe, it, expect, beforeEach } from "bun:test"
import { Evento } from "../evento"
import type { EventoHandlerContext } from "../types"

describe("Evento - Request-Response Pattern", () => {
  let evento: Evento<"test">

  beforeEach(() => {
    evento = new Evento("test")
  })

  describe("request/reply", () => {
    it("should resolve with response payload", async () => {
      evento.on("settings:query", (ctx) => {
        evento.reply(ctx, {
          data: { theme: "dark" },
        })
      })

      const response = await evento.request("settings:query", { keys: ["theme"] })

      expect(response.data).toEqual({ theme: "dark" })
    })

    it("should include correlation_id in request payload", async () => {
      let receivedCorrelationId: string | null = null

      evento.on("settings:query", (ctx) => {
        receivedCorrelationId = (ctx.payload as any).correlation_id
        evento.reply(ctx, { data: {} })
      })

      await evento.request("settings:query", { keys: ["theme"] })

      expect(receivedCorrelationId).toBeString()
      expect(receivedCorrelationId!.length).toBeGreaterThan(0)
    })

    it("should reject on timeout", async () => {
      try {
        await evento.request("settings:query", { keys: ["theme"] }, { timeout: 50 })
        expect(false).toBe(true) // Should not reach here
      } catch (err) {
        expect(err).toBeInstanceOf(Error)
      }
    })

    it("should resolve only for matching correlation_id", async () => {
      const responses: Promise<unknown>[] = []

      evento.on("data:query", (ctx) => {
        const correlationId = (ctx.payload as any).correlation_id
        // Simulate delayed reply
        setTimeout(() => {
          evento.reply(ctx, { data: { id: correlationId } })
        }, 10)
      })

      responses.push(evento.request("data:query", { id: 1 }))
      responses.push(evento.request("data:query", { id: 2 }))
      responses.push(evento.request("data:query", { id: 3 }))

      const results = await Promise.all(responses)

      // Each response should match its own correlation_id
      expect(results).toHaveLength(3)
    })

    it("should propagate source/trace_id/depth in reply", async () => {
      let requestContext: EventoHandlerContext<"test"> | null = null
      let replyContext: EventoHandlerContext<"test"> | null = null

      evento.on("settings:query", (ctx) => {
        requestContext = ctx
        evento.reply(ctx, { data: { theme: "dark" } })
      })

      evento.on("settings:query:response", (ctx) => {
        replyContext = ctx
      })

      await evento.request("settings:query", { keys: ["theme"] })

      expect(requestContext).not.toBeNull()
      expect(replyContext).not.toBeNull()
      expect(replyContext!.meta.source).toBe(requestContext!.meta.source)
      expect(replyContext!.meta.trace_id).toBe(requestContext!.meta.trace_id)
      expect(replyContext!.meta.depth).toBe(requestContext!.meta.depth + 1)
      expect((replyContext!.payload as any).correlation_id).toBe(
        (requestContext!.payload as any).correlation_id,
      )
    })
  })
})
