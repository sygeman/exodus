import { describe, it, expect } from "bun:test"
import { executors } from "./executors"
import { createContext, setNodeOutput } from "./context"

describe("Node Executors", () => {
  describe("trigger", () => {
    it("should pass through input", async () => {
      const ctx = createContext()
      const input = { name: "test", value: 42 }
      const result = await executors.trigger(undefined, input, ctx)
      expect(result.output).toEqual(input)
    })
  })

  describe("condition", () => {
    it("should evaluate eq operator (true)", async () => {
      const ctx = createContext()
      const result = await executors.condition(
        { field: "status", value: "active", operator: "eq" },
        { status: "active" },
        ctx,
      )
      expect(result.output).toEqual({ result: true })
      expect(result.followEdges).toEqual([{ handle: "true" }])
    })

    it("should evaluate eq operator (false)", async () => {
      const ctx = createContext()
      const result = await executors.condition(
        { field: "status", value: "active", operator: "eq" },
        { status: "draft" },
        ctx,
      )
      expect(result.output).toEqual({ result: false })
      expect(result.followEdges).toEqual([{ handle: "false" }])
    })

    it("should evaluate gt operator", async () => {
      const ctx = createContext()
      const result = await executors.condition(
        { field: "age", value: 18, operator: "gt" },
        { age: 25 },
        ctx,
      )
      expect(result.output).toEqual({ result: true })
    })

    it("should evaluate lt operator", async () => {
      const ctx = createContext()
      const result = await executors.condition(
        { field: "price", value: 100, operator: "lt" },
        { price: 50 },
        ctx,
      )
      expect(result.output).toEqual({ result: true })
    })

    it("should evaluate contains operator", async () => {
      const ctx = createContext()
      const result = await executors.condition(
        { field: "name", value: "Ali", operator: "contains" },
        { name: "Alice" },
        ctx,
      )
      expect(result.output).toEqual({ result: true })
    })
  })

  describe("transform", () => {
    it("should set value", async () => {
      const ctx = createContext()
      const result = await executors.transform(
        { field: "x", operation: "set", value: 100 },
        { x: 50 },
        ctx,
      )
      expect(result.output).toEqual({ result: 100 })
    })

    it("should add value", async () => {
      const ctx = createContext()
      const result = await executors.transform(
        { field: "count", operation: "add", value: 5 },
        { count: 10 },
        ctx,
      )
      expect(result.output).toEqual({ result: 15 })
    })

    it("should multiply value", async () => {
      const ctx = createContext()
      const result = await executors.transform(
        { field: "price", operation: "multiply", value: 2 },
        { price: 50 },
        ctx,
      )
      expect(result.output).toEqual({ result: 100 })
    })

    it("should append value", async () => {
      const ctx = createContext()
      const result = await executors.transform(
        { field: "name", operation: "append", value: " World" },
        { name: "Hello" },
        ctx,
      )
      expect(result.output).toEqual({ result: "Hello World" })
    })
  })

  describe("switch", () => {
    it("should match case", async () => {
      const ctx = createContext()
      const result = await executors.switch(
        {
          value: "active",
          cases: [
            { value: "active", handle: "active_case" },
            { value: "draft", handle: "draft_case" },
          ],
          default_handle: "default",
        },
        {},
        ctx,
      )
      expect(result.output).toEqual({ matched_handle: "active_case", value: "active" })
      expect(result.followEdges).toEqual([{ handle: "active_case" }])
    })

    it("should use default handle when no match", async () => {
      const ctx = createContext()
      const result = await executors.switch(
        {
          value: "unknown",
          cases: [
            { value: "active", handle: "active_case" },
            { value: "draft", handle: "draft_case" },
          ],
          default_handle: "default",
        },
        {},
        ctx,
      )
      expect(result.followEdges).toEqual([{ handle: "default" }])
    })

    it("should resolve template in value", async () => {
      const ctx = createContext({ inputs: { type: "active" } })
      const result = await executors.switch(
        {
          value: "{{trigger.inputs.type}}",
          cases: [{ value: "active", handle: "active_case" }],
          default_handle: "default",
        },
        {},
        ctx,
      )
      expect(result.followEdges).toEqual([{ handle: "active_case" }])
    })
  })

  describe("delay", () => {
    it("should delay execution", async () => {
      const ctx = createContext()
      const start = Date.now()
      const result = await executors.delay({ seconds: 1 }, {}, ctx)
      const elapsed = Date.now() - start

      expect(result.output.status).toBe("completed")
      expect(result.output.delayed_seconds).toBe(1)
      expect(elapsed).toBeGreaterThanOrEqual(900)
    })
  })

  describe("input", () => {
    it("should return trigger inputs", async () => {
      const ctx = createContext({ inputs: { name: "Alice", age: 30 } })
      const result = await executors.input(undefined, {}, ctx)
      expect(result.output).toEqual({ name: "Alice", age: 30 })
    })

    it("should return empty object when no inputs", async () => {
      const ctx = createContext({})
      const result = await executors.input(undefined, {}, ctx)
      expect(result.output).toEqual({})
    })
  })

  describe("output", () => {
    it("should resolve output templates", async () => {
      const ctx = createContext({ inputs: { name: "Alice" } })
      setNodeOutput(ctx, "calc", { total: 42 })

      const result = await executors.output(
        {
          outputs: {
            user_name: "{{trigger.inputs.name}}",
            total: "{{nodes.calc.output.total}}",
          },
        },
        {},
        ctx,
      )

      expect(result.output.status).toBe("completed")
      expect(result.output.outputs).toEqual({ user_name: "Alice", total: 42 })
    })
  })
})
