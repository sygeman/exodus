import { describe, it, expect } from "bun:test"
import { registerAction, getActionHandler } from "./actions"
import type { ActionHandler } from "./actions"

describe("actions", () => {
  describe("registerAction", () => {
    it("should register an action handler", () => {
      const handler: ActionHandler = async () => ({
        result: "ok",
      })
      registerAction("test_action", handler)
      expect(getActionHandler("test_action")).toBe(handler)
    })

    it("should overwrite existing handler", () => {
      const handler1: ActionHandler = async () => ({ v: 1 })
      const handler2: ActionHandler = async () => ({ v: 2 })
      registerAction("overwrite", handler1)
      registerAction("overwrite", handler2)
      expect(getActionHandler("overwrite")).toBe(handler2)
    })
  })

  describe("getActionHandler", () => {
    it("should return undefined for unknown action", () => {
      expect(getActionHandler("nonexistent")).toBeUndefined()
    })

    it("should return registered handler", () => {
      const handler: ActionHandler = async () => ({ data: true })
      registerAction("my_action", handler)
      expect(getActionHandler("my_action")).toBe(handler)
    })
  })
})
