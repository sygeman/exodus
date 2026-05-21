import { describe, expect, it } from "bun:test"
import { collectHandlerCode } from "./handlers"
import type { EventBinding } from "@exodus/edem-ui"

describe("collectHandlerCode", () => {
  it("generates runFlow handlers with trigger_data", () => {
    const handlers = new Map<string, string>()
    const events: Record<string, EventBinding> = {
      click: {
        flow: "saveDraft",
        input: {
          payload: "{{ event }}",
          itemId: "{{ item.id }}",
        },
      },
    }

    collectHandlerCode(events, handlers)

    const generated = handlers.get("handleSaveDraft")
    expect(generated).toContain("edem.flows.runFlow")
    expect(generated).toContain('flow_id: "saveDraft"')
    expect(generated).toContain("trigger_data")
    expect(generated).toContain("payload: $event")
    expect(generated).toContain("itemId: item.id")
  })

  it("generates runFlow without trigger_data when no input is provided", () => {
    const handlers = new Map<string, string>()
    const events: Record<string, EventBinding> = {
      submit: {
        flow: "publishPost",
      },
    }

    collectHandlerCode(events, handlers)

    const generated = handlers.get("handlePublishPost")
    expect(generated).toContain('edem.flows.runFlow({ flow_id: "publishPost" })')
  })
})
