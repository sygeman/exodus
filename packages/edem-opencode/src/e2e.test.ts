import { describe, it, expect, beforeAll, afterAll } from "bun:test"
import { createEdem } from "@exodus/edem-core"
import { opencodeModule } from "./module"

describe("opencodeModule e2e", () => {
  let edem: ReturnType<typeof createEdem<[typeof opencodeModule]>>
  const createdSessionIds: string[] = []

  beforeAll(() => {
    edem = createEdem([opencodeModule])
  })

  afterAll(async () => {
    for (const id of createdSessionIds) {
      try {
        await edem.opencode.deleteSession({ id })
      } catch {
        // cleanup best-effort
      }
    }
  })

  it("getConfig", async () => {
    const config = await edem.opencode.getConfig({})
    expect(config).toBeDefined()
    expect(typeof config).toBe("object")
  })

  it("getProviders", async () => {
    const result = await edem.opencode.getProviders({})
    expect(Array.isArray(result.providers)).toBe(true)
    console.log("[e2e] providers:", result.providers.map((p) => p.id).join(", "))
  })

  it("listSessions", async () => {
    const sessions = await edem.opencode.listSessions({})
    expect(Array.isArray(sessions)).toBe(true)
    console.log("[e2e] sessions count:", sessions.length)
  })

  it("session lifecycle: create → get → delete", async () => {
    const session = await edem.opencode.createSession({ title: "e2e lifecycle" })
    expect(session.id).toBeTruthy()
    expect(session.title).toBe("e2e lifecycle")
    createdSessionIds.push(session.id)

    const fetched = await edem.opencode.getSession({ id: session.id })
    expect(fetched.id).toBe(session.id)

    const deleted = await edem.opencode.deleteSession({ id: session.id })
    expect(deleted).toBe(true)
    createdSessionIds.pop()
  })

  it("listMessages for new session returns empty", async () => {
    const session = await edem.opencode.createSession({ title: "msg test" })
    createdSessionIds.push(session.id)

    const messages = await edem.opencode.listMessages({ session_id: session.id })
    expect(messages).toEqual([])
  })

  it("sendPrompt multiple messages in one session", async () => {
    const model = { providerID: "xiaomi-token-plan-sgp", modelID: "mimo-v2.5-pro" }
    const session = await edem.opencode.createSession({ title: "multi-message test" })
    createdSessionIds.push(session.id)

    const edemLive = createEdem([opencodeModule])
    const events: Array<{ type: string; properties: Record<string, unknown> }> = []
    edemLive.opencode.onEvent(({ event }) => {
      events.push({ type: event.type, properties: event.properties })
    })
    await edemLive.opencode.startListening({})

    const prompts = [
      "My name is Alex. Remember this.",
      "What is my name?",
      "What language did I just use to tell you my name?",
    ]

    for (const text of prompts) {
      events.length = 0

      await edemLive.opencode.sendPrompt({
        session_id: session.id,
        parts: [{ type: "text", text }],
        model,
      })

      console.log("[e2e] →", text)

      const deadline = Date.now() + 30000
      let idleAt: number | null = null
      let errorMsg: string | undefined

      while (Date.now() < deadline) {
        for (const ev of events) {
          if (ev.type === "session.error" && !errorMsg) {
            const errData = ev.properties.error as { data?: { message?: string } } | undefined
            errorMsg = errData?.data?.message ?? JSON.stringify(ev.properties)
          }
        }
        if (!idleAt && events.some((e) => e.type === "session.idle")) {
          idleAt = Date.now()
        }
        if (idleAt && Date.now() - idleAt > 1000) break
        await Bun.sleep(200)
      }

      if (errorMsg) throw new Error(`LLM error: ${errorMsg}`)
      if (!idleAt) throw new Error("Timeout waiting for response")
    }

    const allMessages = await edemLive.opencode.listMessages({
      session_id: session.id,
      limit: 50,
    })
    console.log("[e2e] === dialog ===")
    for (const m of allMessages) {
      const text = m.parts
        .filter((p: Record<string, unknown>) => p.type === "text")
        .map((p: Record<string, unknown>) => (typeof p.text === "string" ? p.text : ""))
        .join("")
      console.log(`[e2e] [${m.info.role}] ${text}`)
    }
    console.log("[e2e] === end ===")
    const userCount = allMessages.filter((m) => m.info.role === "user").length
    const assistantCount = allMessages.filter((m) => m.info.role === "assistant").length
    expect(userCount).toBe(3)
    expect(assistantCount).toBe(3)

    const secondReply = allMessages
      .filter((m) => m.info.role === "assistant")[1]
      ?.parts.filter((p: Record<string, unknown>) => p.type === "text")
      .map((p: Record<string, unknown>) => (typeof p.text === "string" ? p.text : ""))
      .join("")
      .toLowerCase()
    expect(secondReply).toContain("alex")
  })

  it("startListening returns true", async () => {
    const edemFresh = createEdem([opencodeModule])
    const result = await edemFresh.opencode.startListening({})
    expect(result).toBe(true)
  })

  it("onEvent receives session events", async () => {
    const events: string[] = []
    const edemFresh = createEdem([opencodeModule])

    edemFresh.opencode.onEvent(({ event }) => {
      events.push(event.type)
    })

    await edemFresh.opencode.startListening({})

    const session = await edem.opencode.createSession({ title: "event test" })
    createdSessionIds.push(session.id)

    await Bun.sleep(1500)

    expect(events.length).toBeGreaterThan(0)
    console.log("[e2e] events received:", [...new Set(events)].join(", "))
  })
})
