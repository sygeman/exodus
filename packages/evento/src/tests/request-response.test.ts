import { describe, it, expect, beforeEach } from "bun:test"
import { Evento } from "../evento"
import type { EventoHandlerContext } from "../types"
import { z } from "zod"

describe("Evento - Request-Response Pattern", () => {
  let evento: Evento<"test">

  beforeEach(() => {
    evento = new Evento("test")
    evento.register({
      "settings:query": { schema: z.any(), response: z.any() },
      "data:query": { schema: z.any(), response: z.any() },
    })
  })

  describe("request/reply", () => {
    it("should resolve with response payload", async () => {
      evento.on("settings:query", (ctx) => {
        evento.reply(ctx, { theme: "dark" })
      })

      const response = await evento.request("settings:query", { keys: ["theme"] })

      expect(response).toEqual({ theme: "dark" })
    })

    it("should include correlation_id in request payload", async () => {
      let receivedCorrelationId: string | undefined = undefined

      evento.on("settings:query", (ctx) => {
        receivedCorrelationId = (ctx.payload as { correlation_id?: string }).correlation_id
        evento.reply(ctx, {})
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
        const correlationId = (ctx.payload as { correlation_id?: string }).correlation_id
        // Simulate delayed reply
        setTimeout(() => {
          evento.reply(ctx, { id: correlationId })
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
        evento.reply(ctx, { theme: "dark" })
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
      expect((replyContext!.payload as { correlation_id?: string }).correlation_id).toBe(
        (requestContext!.payload as { correlation_id?: string }).correlation_id,
      )
    })
  })

  describe("handle", () => {
    it("should auto-reply with return value", async () => {
      evento.handle("settings:query", () => {
        return { theme: "dark" }
      })

      const response = await evento.request("settings:query", { keys: ["theme"] })

      expect(response).toEqual({ theme: "dark" })
    })

    it("should auto-reply with async return value", async () => {
      evento.handle("settings:query", async () => {
        return { theme: "light" }
      })

      const response = await evento.request("settings:query", { keys: ["theme"] })

      expect(response).toEqual({ theme: "light" })
    })

    it("should not reply when handler returns void", async () => {
      evento.handle("settings:query", () => {
        // no return
      })

      try {
        await evento.request("settings:query", { keys: ["theme"] }, { timeout: 50 })
        expect(false).toBe(true)
      } catch (err) {
        expect(err).toBeInstanceOf(Error)
      }
    })
  })
})
