import { createEdemModule } from "@exodus/edem-core"
import { z } from "zod"

const SSEEventSchema = z.object({
  id: z.string(),
  event: z.string(),
  data: z.string(),
})

export const netModule = createEdemModule("net", (module) =>
  module
    .subscription("onSSEEvent", { output: SSEEventSchema })

    .mutation("request", {
      input: z.object({
        method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
        url: z.string(),
        headers: z.record(z.string(), z.string()).optional(),
        body: z.unknown().optional(),
      }),
      output: z.object({
        status: z.number(),
        headers: z.record(z.string(), z.string()),
        body: z.string(),
      }),
      resolve: async ({ input }) => {
        const response = await fetch(input.url, {
          method: input.method,
          headers: input.headers,
          body: input.body !== undefined ? JSON.stringify(input.body) : undefined,
        })

        const headers: Record<string, string> = {}
        response.headers.forEach((value, key) => {
          headers[key] = value
        })

        const body = await response.text()
        return { status: response.status, headers, body }
      },
    })

    .mutation("streamSSE", {
      input: z.object({
        method: z.enum(["GET", "POST"]).default("POST"),
        url: z.string(),
        headers: z.record(z.string(), z.string()).optional(),
        body: z.unknown().optional(),
      }),
      output: z.object({
        status: z.number(),
        body: z.string(),
      }),
      resolve: async ({ input, emit }) => {
        const response = await fetch(input.url, {
          method: input.method,
          headers: {
            ...input.headers,
            Accept: "text/event-stream",
          },
          body: input.body !== undefined ? JSON.stringify(input.body) : undefined,
        })

        if (!response.ok) {
          const text = await response.text()
          throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`)
        }

        const reader = response.body?.getReader()
        if (!reader) throw new Error("No response body")

        const decoder = new TextDecoder()
        let buffer = ""
        let fullBody = ""
        let eventId = ""
        let eventName = ""

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split("\n")
            buffer = lines.pop() ?? ""

            for (const line of lines) {
              const trimmed = line.trim()
              if (!trimmed) continue

              if (trimmed.startsWith("id: ")) {
                eventId = trimmed.slice(4)
              } else if (trimmed.startsWith("event: ")) {
                eventName = trimmed.slice(7)
              } else if (trimmed.startsWith("data: ")) {
                const data = trimmed.slice(6)
                fullBody += data
                await emit.onSSEEvent({
                  id: eventId || `sse-${Date.now()}`,
                  event: eventName || "message",
                  data,
                })
                eventId = ""
                eventName = ""
              } else if (trimmed === "data:") {
                // empty data line
              }
            }
          }
        } finally {
          reader.releaseLock()
        }

        return { status: response.status, body: fullBody }
      },
    }),
)

export default netModule
