import { createEdemModule } from "@exodus/edem-core"
import { z } from "zod"
import { createOpencodeClient, type OpencodeClient } from "@opencode-ai/sdk"

const DEFAULT_BASE_URL = "http://127.0.0.1:4096"

const SessionSchema = z.object({
  id: z.string(),
  title: z.string(),
  directory: z.string(),
  parentID: z.string().optional(),
  version: z.string(),
  time: z.object({
    created: z.number(),
    updated: z.number(),
  }),
})

const MessageInfoSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  sessionID: z.string(),
})

const MessageSchema = z.object({
  info: MessageInfoSchema,
  parts: z.array(z.record(z.string(), z.unknown())),
})

const ProviderSchema = z.object({
  id: z.string(),
  name: z.string(),
  models: z.record(z.string(), z.record(z.string(), z.unknown())),
})

const EventSchema = z.object({
  type: z.string(),
  properties: z.record(z.string(), z.unknown()),
})

const ProvidersResponseSchema = z.object({
  providers: z.array(ProviderSchema),
  default: z.record(z.string(), z.string()),
})

const log = (..._args: unknown[]) => {}
const logError = (...args: unknown[]) => console.error("[opencode]", ...args)

type Ctx = { client: OpencodeClient }

export const opencodeModule = createEdemModule("opencode", (module) =>
  module
    .context(async () => {
      log("init client →", DEFAULT_BASE_URL)
      const client = createOpencodeClient({ baseUrl: DEFAULT_BASE_URL })
      return { client }
    })

    .subscription("onEvent", { output: EventSchema })

    .query("listSessions", {
      input: z.object({}),
      output: z.array(SessionSchema),
      resolve: async ({ ctx }) => {
        log("listSessions")
        try {
          const result = await (ctx as Ctx).client.session.list()
          const data = (result.data ?? []) as z.infer<typeof SessionSchema>[]
          log("listSessions →", data.length, "sessions")
          return data
        } catch (err) {
          logError("listSessions error:", err)
          throw err
        }
      },
    })

    .query("getSession", {
      input: z.object({ id: z.string() }),
      output: SessionSchema,
      resolve: async ({ input, ctx }) => {
        log("getSession", input.id)
        try {
          const result = await (ctx as Ctx).client.session.get({ path: { id: input.id } })
          log("getSession →", result.data?.id)
          return result.data as z.infer<typeof SessionSchema>
        } catch (err) {
          logError("getSession error:", err)
          throw err
        }
      },
    })

    .query("listMessages", {
      input: z.object({
        session_id: z.string(),
        limit: z.number().optional(),
      }),
      output: z.array(MessageSchema),
      resolve: async ({ input, ctx }) => {
        log("listMessages", input.session_id, input.limit ? `limit=${input.limit}` : "")
        try {
          const result = await (ctx as Ctx).client.session.messages({
            path: { id: input.session_id },
            query: input.limit ? { limit: input.limit } : undefined,
          })
          const data = (result.data ?? []) as z.infer<typeof MessageSchema>[]
          log("listMessages →", data.length, "messages")
          return data
        } catch (err) {
          logError("listMessages error:", err)
          throw err
        }
      },
    })

    .query("getProviders", {
      input: z.object({}),
      output: ProvidersResponseSchema,
      resolve: async ({ ctx }) => {
        log("getProviders")
        try {
          const result = await (ctx as Ctx).client.config.providers()
          const data = (result.data ?? { providers: [], default: {} }) as z.infer<
            typeof ProvidersResponseSchema
          >
          log("getProviders →", data.providers.length, "providers")
          return data
        } catch (err) {
          logError("getProviders error:", err)
          throw err
        }
      },
    })

    .query("getConfig", {
      input: z.object({}),
      output: z.record(z.string(), z.unknown()),
      resolve: async ({ ctx }) => {
        log("getConfig")
        try {
          const result = await (ctx as Ctx).client.config.get()
          const data = (result.data ?? {}) as Record<string, unknown>
          log("getConfig →", Object.keys(data).length, "keys")
          return data
        } catch (err) {
          logError("getConfig error:", err)
          throw err
        }
      },
    })

    .mutation("createSession", {
      input: z.object({ title: z.string().optional() }),
      output: SessionSchema,
      resolve: async ({ input, ctx }) => {
        log("createSession", input.title ?? "(no title)")
        try {
          const result = await (ctx as Ctx).client.session.create({ body: { title: input.title } })
          log("createSession →", result.data?.id)
          return result.data as z.infer<typeof SessionSchema>
        } catch (err) {
          logError("createSession error:", err)
          throw err
        }
      },
    })

    .mutation("deleteSession", {
      input: z.object({ id: z.string() }),
      output: z.boolean(),
      resolve: async ({ input, ctx }) => {
        log("deleteSession", input.id)
        try {
          const result = await (ctx as Ctx).client.session.delete({ path: { id: input.id } })
          log("deleteSession →", result.data)
          return result.data ?? false
        } catch (err) {
          logError("deleteSession error:", err)
          throw err
        }
      },
    })

    .mutation("sendPrompt", {
      input: z.object({
        session_id: z.string(),
        parts: z.array(
          z.object({
            type: z.literal("text"),
            text: z.string(),
          }),
        ),
        model: z
          .object({
            providerID: z.string(),
            modelID: z.string(),
          })
          .optional(),
      }),
      output: z.boolean(),
      resolve: async ({ input, ctx }) => {
        log("sendPrompt", input.session_id, {
          parts: input.parts.length,
          model: input.model ? `${input.model.providerID}/${input.model.modelID}` : "default",
        })
        try {
          await (ctx as Ctx).client.session.promptAsync({
            path: { id: input.session_id },
            body: {
              parts: input.parts,
              model: input.model,
            },
          })
          log("sendPrompt → accepted")
          return true
        } catch (err) {
          logError("sendPrompt error:", err)
          throw err
        }
      },
    })

    .mutation("abortSession", {
      input: z.object({ id: z.string() }),
      output: z.boolean(),
      resolve: async ({ input, ctx }) => {
        log("abortSession", input.id)
        try {
          const result = await (ctx as Ctx).client.session.abort({ path: { id: input.id } })
          log("abortSession →", result.data)
          return result.data ?? false
        } catch (err) {
          logError("abortSession error:", err)
          throw err
        }
      },
    })

    .mutation("summarize", {
      input: z.object({ id: z.string() }),
      output: z.boolean(),
      resolve: async ({ input, ctx }) => {
        log("summarize", input.id)
        try {
          const result = await (ctx as Ctx).client.session.summarize({ path: { id: input.id } })
          log("summarize →", result.data)
          return result.data ?? false
        } catch (err) {
          logError("summarize error:", err)
          throw err
        }
      },
    })

    .mutation("syncProvider", {
      input: z.object({
        id: z.string(),
        api_url: z.string(),
        api_key: z.string(),
        models: z.array(z.string()),
      }),
      output: z.boolean(),
      resolve: async ({ input, ctx }) => {
        log("syncProvider", input.id, {
          api_url: input.api_url,
          models: input.models.length,
        })
        const client = (ctx as Ctx).client

        const models: Record<string, object> = {}
        for (const m of input.models) {
          models[m] = {}
        }

        try {
          await client.config.update({
            body: {
              provider: {
                [input.id]: {
                  npm: "@ai-sdk/openai-compatible",
                  name: input.id,
                  options: { baseURL: input.api_url },
                  models,
                },
              },
            },
          } as unknown as Parameters<typeof client.config.update>[0])

          await client.auth.set({
            path: { id: input.id },
            body: { type: "api", key: input.api_key },
          })

          log("syncProvider → ok")
          return true
        } catch (err) {
          logError("syncProvider error:", err)
          throw err
        }
      },
    })

    .mutation("removeProvider", {
      input: z.object({ id: z.string() }),
      output: z.boolean(),
      resolve: async ({ input, ctx }) => {
        log("removeProvider", input.id)
        const client = (ctx as Ctx).client

        try {
          await client.config.update({
            body: {
              provider: {
                [input.id]: undefined,
              } as Record<string, unknown>,
            },
          } as unknown as Parameters<typeof client.config.update>[0])

          log("removeProvider → ok")
          return true
        } catch (err) {
          logError("removeProvider error:", err)
          throw err
        }
      },
    })

    .mutation("startListening", {
      input: z.object({}),
      output: z.boolean(),
      resolve: async ({ ctx, emit }) => {
        const client = (ctx as Ctx).client
        log("startListening")

        try {
          const events = await client.global.event()
          log("startListening → stream connected")

          ;(async () => {
            try {
              for await (const event of events.stream) {
                const ev = event as {
                  payload?: { type?: string; properties?: Record<string, unknown> }
                }
                const type = ev.payload?.type ?? "unknown"
                log("event ←", type)
                await emit.onEvent({
                  type,
                  properties: ev.payload?.properties ?? {},
                })
              }
            } catch (err) {
              logError("stream error:", err)
              await emit.onEvent({
                type: "connection.lost",
                properties: {},
              })
            }
          })()

          return true
        } catch (err) {
          logError("startListening error:", err)
          return false
        }
      },
    }),
)

export default opencodeModule
