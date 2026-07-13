import { describe, it, expect, beforeEach, mock } from "bun:test"
import { createEdem } from "@exodus/edem-core"

type MockFn = ReturnType<typeof mock>

const mockSessionList: MockFn = mock(() => Promise.resolve({ data: [] }))
const mockSessionGet: MockFn = mock(() => Promise.resolve({ data: null }))
const mockSessionCreate: MockFn = mock(() => Promise.resolve({ data: null }))
const mockSessionDelete: MockFn = mock(() => Promise.resolve({ data: true }))
const mockSessionMessages: MockFn = mock(() => Promise.resolve({ data: [] }))
const mockSessionPromptAsync: MockFn = mock(() => Promise.resolve({ data: undefined }))
const mockSessionAbort: MockFn = mock(() => Promise.resolve({ data: true }))
const mockSessionSummarize: MockFn = mock(() => Promise.resolve({ data: true }))
const mockConfigGet: MockFn = mock(() => Promise.resolve({ data: {} }))
const mockConfigProviders: MockFn = mock(() =>
  Promise.resolve({ data: { providers: [], default: {} } }),
)
const mockConfigUpdate: MockFn = mock(() => Promise.resolve({ data: undefined }))
const mockAuthSet: MockFn = mock(() => Promise.resolve({ data: true }))
const mockGlobalEvent: MockFn = mock(() => Promise.resolve({ stream: (async function* () {})() }))

mock.module("@opencode-ai/sdk", () => ({
  createOpencodeClient: () => ({
    session: {
      list: mockSessionList,
      get: mockSessionGet,
      create: mockSessionCreate,
      delete: mockSessionDelete,
      messages: mockSessionMessages,
      promptAsync: mockSessionPromptAsync,
      abort: mockSessionAbort,
      summarize: mockSessionSummarize,
    },
    config: {
      get: mockConfigGet,
      providers: mockConfigProviders,
      update: mockConfigUpdate,
    },
    auth: {
      set: mockAuthSet,
    },
    global: {
      event: mockGlobalEvent,
    },
  }),
}))

const { opencodeModule } = await import("./module")

const testSession = {
  id: "sess-1",
  title: "Test Session",
  directory: "/test",
  version: "1.0.0",
  time: { created: 1000, updated: 2000 },
}

const testMessage = {
  info: {
    id: "msg-1",
    role: "user",
    sessionID: "sess-1",
  },
  parts: [{ type: "text", text: "hello" }],
}

const testProvider = {
  id: "openai",
  name: "OpenAI",
  source: "config",
  env: [],
  options: {},
  models: { "gpt-4": {} },
}

function resetMocks() {
  for (const fn of [
    mockSessionList,
    mockSessionGet,
    mockSessionCreate,
    mockSessionDelete,
    mockSessionMessages,
    mockSessionPromptAsync,
    mockSessionAbort,
    mockSessionSummarize,
    mockConfigGet,
    mockConfigProviders,
    mockConfigUpdate,
    mockAuthSet,
    mockGlobalEvent,
  ]) {
    fn.mockClear()
  }

  mockSessionList.mockResolvedValue({ data: [] })
  mockSessionGet.mockResolvedValue({ data: null })
  mockSessionCreate.mockResolvedValue({ data: null })
  mockSessionDelete.mockResolvedValue({ data: true })
  mockSessionMessages.mockResolvedValue({ data: [] })
  mockSessionPromptAsync.mockResolvedValue({ data: undefined })
  mockSessionAbort.mockResolvedValue({ data: true })
  mockSessionSummarize.mockResolvedValue({ data: true })
  mockConfigGet.mockResolvedValue({ data: {} })
  mockConfigProviders.mockResolvedValue({ data: { providers: [], default: {} } })
  mockConfigUpdate.mockResolvedValue({ data: undefined })
  mockAuthSet.mockResolvedValue({ data: true })
  mockGlobalEvent.mockResolvedValue({ stream: (async function* () {})() })
}

describe("opencodeModule", () => {
  beforeEach(() => {
    resetMocks()
  })

  describe("listSessions", () => {
    it("should return empty array when no sessions", async () => {
      const edem = createEdem([opencodeModule])
      const result = await edem.opencode.listSessions({})
      expect(result).toEqual([])
    })

    it("should return sessions from SDK", async () => {
      mockSessionList.mockResolvedValue({ data: [testSession] })
      const edem = createEdem([opencodeModule])
      const result = await edem.opencode.listSessions({})
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe("sess-1")
      expect(result[0].title).toBe("Test Session")
    })

    it("should strip extra fields from session", async () => {
      mockSessionList.mockResolvedValue({
        data: [{ ...testSession, projectID: "proj-1", extra: "value" }],
      })
      const edem = createEdem([opencodeModule])
      const result = await edem.opencode.listSessions({})
      expect(result[0]).not.toHaveProperty("projectID")
      expect(result[0]).not.toHaveProperty("extra")
      expect(result[0].id).toBe("sess-1")
    })
  })

  describe("getSession", () => {
    it("should return session by id", async () => {
      mockSessionGet.mockResolvedValue({ data: testSession })
      const edem = createEdem([opencodeModule])
      const result = await edem.opencode.getSession({ id: "sess-1" })
      expect(result.id).toBe("sess-1")
      expect(mockSessionGet).toHaveBeenCalledWith({ path: { id: "sess-1" } })
    })
  })

  describe("listMessages", () => {
    it("should return messages for session", async () => {
      mockSessionMessages.mockResolvedValue({ data: [testMessage] })
      const edem = createEdem([opencodeModule])
      const result = await edem.opencode.listMessages({ session_id: "sess-1" })
      expect(result).toHaveLength(1)
      expect(result[0].info.id).toBe("msg-1")
      expect(mockSessionMessages).toHaveBeenCalledWith({
        path: { id: "sess-1" },
        query: undefined,
      })
    })

    it("should pass limit to SDK", async () => {
      mockSessionMessages.mockResolvedValue({ data: [] })
      const edem = createEdem([opencodeModule])
      await edem.opencode.listMessages({ session_id: "sess-1", limit: 10 })
      expect(mockSessionMessages).toHaveBeenCalledWith({
        path: { id: "sess-1" },
        query: { limit: 10 },
      })
    })

    it("should return empty array when no messages", async () => {
      mockSessionMessages.mockResolvedValue({ data: undefined })
      const edem = createEdem([opencodeModule])
      const result = await edem.opencode.listMessages({ session_id: "sess-1" })
      expect(result).toEqual([])
    })
  })

  describe("getProviders", () => {
    it("should return providers", async () => {
      mockConfigProviders.mockResolvedValue({
        data: {
          providers: [testProvider],
          default: { chat: "openai/gpt-4" },
        },
      })
      const edem = createEdem([opencodeModule])
      const result = await edem.opencode.getProviders({})
      expect(result.providers).toHaveLength(1)
      expect(result.providers[0].id).toBe("openai")
      expect(result.default).toEqual({ chat: "openai/gpt-4" })
    })

    it("should return defaults when no data", async () => {
      mockConfigProviders.mockResolvedValue({ data: undefined })
      const edem = createEdem([opencodeModule])
      const result = await edem.opencode.getProviders({})
      expect(result.providers).toEqual([])
      expect(result.default).toEqual({})
    })
  })

  describe("getConfig", () => {
    it("should return config", async () => {
      mockConfigGet.mockResolvedValue({ data: { theme: "dark" } })
      const edem = createEdem([opencodeModule])
      const result = await edem.opencode.getConfig({})
      expect(result).toEqual({ theme: "dark" })
    })

    it("should return empty object when no data", async () => {
      mockConfigGet.mockResolvedValue({ data: undefined })
      const edem = createEdem([opencodeModule])
      const result = await edem.opencode.getConfig({})
      expect(result).toEqual({})
    })
  })

  describe("createSession", () => {
    it("should create session", async () => {
      mockSessionCreate.mockResolvedValue({ data: testSession })
      const edem = createEdem([opencodeModule])
      const result = await edem.opencode.createSession({ title: "Test Session" })
      expect(result.id).toBe("sess-1")
      expect(mockSessionCreate).toHaveBeenCalledWith({ body: { title: "Test Session" } })
    })

    it("should create session without title", async () => {
      mockSessionCreate.mockResolvedValue({ data: testSession })
      const edem = createEdem([opencodeModule])
      await edem.opencode.createSession({})
      expect(mockSessionCreate).toHaveBeenCalledWith({ body: { title: undefined } })
    })
  })

  describe("deleteSession", () => {
    it("should delete session", async () => {
      const edem = createEdem([opencodeModule])
      const result = await edem.opencode.deleteSession({ id: "sess-1" })
      expect(result).toBe(true)
      expect(mockSessionDelete).toHaveBeenCalledWith({ path: { id: "sess-1" } })
    })

    it("should return false when data is undefined", async () => {
      mockSessionDelete.mockResolvedValue({ data: undefined })
      const edem = createEdem([opencodeModule])
      const result = await edem.opencode.deleteSession({ id: "sess-1" })
      expect(result).toBe(false)
    })
  })

  describe("sendPrompt", () => {
    it("should send prompt to session", async () => {
      const edem = createEdem([opencodeModule])
      const result = await edem.opencode.sendPrompt({
        session_id: "sess-1",
        parts: [{ type: "text", text: "hello" }],
      })
      expect(result).toBe(true)
      expect(mockSessionPromptAsync).toHaveBeenCalledWith({
        path: { id: "sess-1" },
        body: {
          parts: [{ type: "text", text: "hello" }],
          model: undefined,
        },
      })
    })

    it("should pass model to SDK", async () => {
      const edem = createEdem([opencodeModule])
      await edem.opencode.sendPrompt({
        session_id: "sess-1",
        parts: [{ type: "text", text: "hello" }],
        model: { providerID: "openai", modelID: "gpt-4" },
      })
      expect(mockSessionPromptAsync).toHaveBeenCalledWith({
        path: { id: "sess-1" },
        body: {
          parts: [{ type: "text", text: "hello" }],
          model: { providerID: "openai", modelID: "gpt-4" },
        },
      })
    })
  })

  describe("abortSession", () => {
    it("should abort session", async () => {
      const edem = createEdem([opencodeModule])
      const result = await edem.opencode.abortSession({ id: "sess-1" })
      expect(result).toBe(true)
      expect(mockSessionAbort).toHaveBeenCalledWith({ path: { id: "sess-1" } })
    })

    it("should return false when data is undefined", async () => {
      mockSessionAbort.mockResolvedValue({ data: undefined })
      const edem = createEdem([opencodeModule])
      const result = await edem.opencode.abortSession({ id: "sess-1" })
      expect(result).toBe(false)
    })
  })

  describe("summarize", () => {
    it("should summarize session", async () => {
      const edem = createEdem([opencodeModule])
      const result = await edem.opencode.summarize({ id: "sess-1" })
      expect(result).toBe(true)
      expect(mockSessionSummarize).toHaveBeenCalledWith({ path: { id: "sess-1" } })
    })

    it("should return false when data is undefined", async () => {
      mockSessionSummarize.mockResolvedValue({ data: undefined })
      const edem = createEdem([opencodeModule])
      const result = await edem.opencode.summarize({ id: "sess-1" })
      expect(result).toBe(false)
    })
  })

  describe("syncProvider", () => {
    it("should update config and set auth", async () => {
      const edem = createEdem([opencodeModule])
      const result = await edem.opencode.syncProvider({
        id: "openai",
        api_url: "https://api.openai.com/v1",
        api_key: "sk-test",
        models: ["gpt-4", "gpt-3.5-turbo"],
      })
      expect(result).toBe(true)
      expect(mockConfigUpdate).toHaveBeenCalledWith({
        body: {
          provider: {
            openai: {
              npm: "@ai-sdk/openai-compatible",
              name: "openai",
              options: { baseURL: "https://api.openai.com/v1" },
              models: { "gpt-4": {}, "gpt-3.5-turbo": {} },
            },
          },
        },
      })
      expect(mockAuthSet).toHaveBeenCalledWith({
        path: { id: "openai" },
        body: { type: "api", key: "sk-test" },
      })
    })

    it("should handle empty models", async () => {
      const edem = createEdem([opencodeModule])
      await edem.opencode.syncProvider({
        id: "custom",
        api_url: "http://localhost:8080",
        api_key: "key",
        models: [],
      })
      expect(mockConfigUpdate).toHaveBeenCalledWith({
        body: {
          provider: {
            custom: {
              npm: "@ai-sdk/openai-compatible",
              name: "custom",
              options: { baseURL: "http://localhost:8080" },
              models: {},
            },
          },
        },
      })
    })
  })

  describe("removeProvider", () => {
    it("should set provider to undefined in config", async () => {
      const edem = createEdem([opencodeModule])
      const result = await edem.opencode.removeProvider({ id: "openai" })
      expect(result).toBe(true)
      expect(mockConfigUpdate).toHaveBeenCalledWith({
        body: {
          provider: {
            openai: undefined,
          },
        },
      })
    })
  })

  describe("startListening", () => {
    it("should return true on success", async () => {
      const edem = createEdem([opencodeModule])
      const result = await edem.opencode.startListening({})
      expect(result).toBe(true)
      expect(mockGlobalEvent).toHaveBeenCalled()
    })

    it("should return false when event() throws", async () => {
      mockGlobalEvent.mockRejectedValue(new Error("connection refused"))
      const edem = createEdem([opencodeModule])
      const result = await edem.opencode.startListening({})
      expect(result).toBe(false)
    })

    it("should emit events from stream", async () => {
      const events: Array<{ type: string; properties: Record<string, unknown> }> = []

      async function* fakeStream() {
        yield { payload: { type: "session.created", properties: { id: "s1" } } }
        yield { payload: { type: "message.updated", properties: { id: "m1" } } }
      }

      mockGlobalEvent.mockResolvedValue({ stream: fakeStream() })

      const edem = createEdem([opencodeModule])
      edem.opencode.onEvent(({ event }) => {
        events.push({ type: event.type, properties: event.properties })
      })

      await edem.opencode.startListening({})
      await Bun.sleep(50)

      expect(events).toHaveLength(2)
      expect(events[0].type).toBe("session.created")
      expect(events[0].properties).toEqual({ id: "s1" })
      expect(events[1].type).toBe("message.updated")
    })

    it("should emit connection.lost when stream errors", async () => {
      const events: Array<{ type: string; properties: Record<string, unknown> }> = []

      async function* failingStream() {
        yield { payload: { type: "test", properties: {} } }
        throw new Error("stream broken")
      }

      mockGlobalEvent.mockResolvedValue({ stream: failingStream() })

      const edem = createEdem([opencodeModule])
      edem.opencode.onEvent(({ event }) => {
        events.push({ type: event.type, properties: event.properties })
      })

      await edem.opencode.startListening({})
      await Bun.sleep(50)

      expect(events.some((e) => e.type === "connection.lost")).toBe(true)
    })

    it("should emit unknown type when payload type is missing", async () => {
      const events: Array<{ type: string; properties: Record<string, unknown> }> = []

      async function* streamWithMissingType() {
        yield { payload: { properties: { data: "test" } } }
      }

      mockGlobalEvent.mockResolvedValue({ stream: streamWithMissingType() })

      const edem = createEdem([opencodeModule])
      edem.opencode.onEvent(({ event }) => {
        events.push({ type: event.type, properties: event.properties })
      })

      await edem.opencode.startListening({})
      await Bun.sleep(50)

      expect(events[0].type).toBe("unknown")
    })
  })

  describe("onEvent subscription", () => {
    it("should register handler and receive events", async () => {
      const events: string[] = []

      async function* fakeStream() {
        yield { payload: { type: "test.event", properties: {} } }
      }
      mockGlobalEvent.mockResolvedValue({ stream: fakeStream() })

      const edem = createEdem([opencodeModule])
      edem.opencode.onEvent(({ event }) => {
        events.push(event.type)
      })
      await edem.opencode.startListening({})
      await Bun.sleep(50)

      expect(events).toContain("test.event")
    })
  })

  describe("schema validation", () => {
    it("should reject invalid session input for getSession", async () => {
      const edem = createEdem([opencodeModule])
      await expect(edem.opencode.getSession({ id: 123 as unknown as string })).rejects.toThrow()
    })

    it("should reject invalid sendPrompt parts", async () => {
      const edem = createEdem([opencodeModule])
      await expect(
        edem.opencode.sendPrompt({
          session_id: "sess-1",
          parts: [{ type: "image" as "text", text: "test" }],
        }),
      ).rejects.toThrow()
    })
  })
})
