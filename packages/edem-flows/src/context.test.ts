import { describe, it, expect } from "bun:test"
import {
  createContext,
  setNodeOutput,
  setFlowVariable,
  resolveTemplate,
  resolveVariable,
  resolveNodeInput,
} from "./context"

describe("FlowContext", () => {
  it("should create empty context", () => {
    const ctx = createContext()
    expect(ctx.trigger_data).toEqual({})
    expect(ctx.node_outputs).toEqual({})
    expect(ctx.flow_variables).toEqual({})
  })

  it("should create context with trigger data", () => {
    const ctx = createContext({ name: "test" })
    expect(ctx.trigger_data).toEqual({ name: "test" })
  })

  it("should set node output", () => {
    const ctx = createContext()
    setNodeOutput(ctx, "node1", { result: 42 })
    expect(ctx.node_outputs.node1).toEqual({ result: 42 })
  })

  it("should set flow variable", () => {
    const ctx = createContext()
    setFlowVariable(ctx, "counter", 10)
    expect(ctx.flow_variables.counter).toBe(10)
  })
})

describe("resolveTemplate", () => {
  it("should return string without templates as-is", () => {
    const ctx = createContext()
    expect(resolveTemplate("hello", ctx)).toBe("hello")
  })

  it("should resolve trigger data", () => {
    const ctx = createContext({ inputs: { name: "Alice" } })
    expect(resolveTemplate("{{trigger.inputs.name}}", ctx)).toBe("Alice")
  })

  it("should resolve node output", () => {
    const ctx = createContext()
    setNodeOutput(ctx, "abc", { count: 42 })
    expect(resolveTemplate("{{nodes.abc.output.count}}", ctx)).toBe(42)
  })

  it("should resolve flow variable", () => {
    const ctx = createContext()
    setFlowVariable(ctx, "total", 100)
    expect(resolveTemplate("{{context.total}}", ctx)).toBe(100)
  })

  it("should interpolate multiple templates", () => {
    const ctx = createContext({ inputs: { name: "Alice" } })
    setNodeOutput(ctx, "n1", { count: 5 })
    expect(
      resolveTemplate("{{trigger.inputs.name}} has {{nodes.n1.output.count}} items", ctx),
    ).toBe("Alice has 5 items")
  })

  it("should return undefined for missing paths", () => {
    const ctx = createContext()
    expect(resolveTemplate("{{trigger.missing}}", ctx)).toBeUndefined()
  })
})

describe("resolveVariable", () => {
  it("should resolve nested object path", () => {
    const ctx = createContext({ a: { b: { c: 123 } } })
    expect(resolveVariable("trigger.a.b.c", ctx)).toBe(123)
  })

  it("should resolve array index", () => {
    const ctx = createContext({ items: [10, 20, 30] })
    expect(resolveVariable("trigger.items.1", ctx)).toBe(20)
  })

  it("should return undefined for unknown scope", () => {
    const ctx = createContext()
    expect(resolveVariable("unknown.value", ctx)).toBeUndefined()
  })
})

describe("resolveNodeInput", () => {
  it("should return empty object for undefined config", () => {
    const ctx = createContext()
    expect(resolveNodeInput(undefined, ctx)).toEqual({})
  })

  it("should resolve template strings in config", () => {
    const ctx = createContext({ inputs: { name: "Bob" } })
    const config = { greeting: "Hello {{trigger.inputs.name}}!" }
    expect(resolveNodeInput(config, ctx)).toEqual({ greeting: "Hello Bob!" })
  })

  it("should pass through non-string values", () => {
    const ctx = createContext()
    const config = { count: 42, active: true }
    expect(resolveNodeInput(config, ctx)).toEqual({ count: 42, active: true })
  })
})
