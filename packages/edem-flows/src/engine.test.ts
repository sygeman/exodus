import { describe, it, expect } from "bun:test"
import { executeFlow } from "./engine"
import type { Flow } from "./engine"

describe("executeFlow", () => {
  it("should execute empty flow", async () => {
    const flow: Flow = {
      id: "test",
      name: "Test Flow",
      nodes: [],
      edges: [],
    }
    const result = await executeFlow(flow)
    expect(result.status).toBe("completed")
  })

  it("should execute single trigger node", async () => {
    const flow: Flow = {
      id: "test",
      name: "Test Flow",
      nodes: [{ id: "n1", type: "trigger", position: { x: 0, y: 0 } }],
      edges: [],
    }
    const result = await executeFlow(flow, { name: "Alice" })
    expect(result.status).toBe("completed")
    expect(result.context.node_outputs.n1).toEqual({ name: "Alice" })
  })

  it("should follow edges", async () => {
    const flow: Flow = {
      id: "test",
      name: "Test Flow",
      nodes: [
        { id: "n1", type: "trigger", position: { x: 0, y: 0 } },
        {
          id: "n2",
          type: "transform",
          position: { x: 100, y: 0 },
          data: { field: "value", operation: "add", value: 10 },
        },
      ],
      edges: [{ id: "e1", source: "n1", target: "n2" }],
    }
    const result = await executeFlow(flow, { value: 5 })
    expect(result.status).toBe("completed")
    expect(result.context.node_outputs.n2).toEqual({ result: 15 })
  })

  it("should handle condition branching", async () => {
    const flow: Flow = {
      id: "test",
      name: "Test Flow",
      nodes: [
        { id: "n1", type: "trigger", position: { x: 0, y: 0 } },
        {
          id: "n2",
          type: "condition",
          position: { x: 100, y: 0 },
          data: { field: "status", value: "active", operator: "eq" },
        },
        {
          id: "n3",
          type: "transform",
          position: { x: 200, y: 0 },
          data: { field: "result", operation: "set", value: "yes" },
        },
        {
          id: "n4",
          type: "transform",
          position: { x: 200, y: 100 },
          data: { field: "result", operation: "set", value: "no" },
        },
      ],
      edges: [
        { id: "e1", source: "n1", target: "n2" },
        { id: "e2", source: "n2", target: "n3", sourceHandle: "true" },
        { id: "e3", source: "n2", target: "n4", sourceHandle: "false" },
      ],
    }

    const result = await executeFlow(flow, { status: "active" })
    expect(result.status).toBe("completed")
    expect(result.context.node_outputs.n3).toEqual({ result: "yes" })
    expect(result.context.node_outputs.n4).toBeUndefined()
  })

  it("should handle switch branching", async () => {
    const flow: Flow = {
      id: "test",
      name: "Test Flow",
      nodes: [
        { id: "n1", type: "trigger", position: { x: 0, y: 0 } },
        {
          id: "n2",
          type: "switch",
          position: { x: 100, y: 0 },
          data: {
            value: "{{trigger.type}}",
            cases: [
              { value: "a", handle: "case_a" },
              { value: "b", handle: "case_b" },
            ],
            default_handle: "default",
          },
        },
        {
          id: "n3",
          type: "transform",
          position: { x: 200, y: 0 },
          data: { field: "selected", operation: "set", value: "A" },
        },
        {
          id: "n4",
          type: "transform",
          position: { x: 200, y: 100 },
          data: { field: "selected", operation: "set", value: "B" },
        },
      ],
      edges: [
        { id: "e1", source: "n1", target: "n2" },
        { id: "e2", source: "n2", target: "n3", label: "case_a" },
        { id: "e3", source: "n2", target: "n4", label: "case_b" },
      ],
    }

    const result = await executeFlow(flow, { type: "a" })
    expect(result.status).toBe("completed")
    expect(result.context.node_outputs.n3).toEqual({ result: "A" })
  })

  it("should handle chain of transforms", async () => {
    const flow: Flow = {
      id: "test",
      name: "Test Flow",
      nodes: [
        { id: "n1", type: "trigger", position: { x: 0, y: 0 } },
        {
          id: "n2",
          type: "transform",
          position: { x: 100, y: 0 },
          data: { field: "x", operation: "add", value: 10 },
        },
        {
          id: "n3",
          type: "transform",
          position: { x: 200, y: 0 },
          data: { field: "result", operation: "multiply", value: 2 },
        },
      ],
      edges: [
        { id: "e1", source: "n1", target: "n2" },
        { id: "e2", source: "n2", target: "n3" },
      ],
    }

    const result = await executeFlow(flow, { x: 5 })
    expect(result.status).toBe("completed")
    expect(result.context.node_outputs.n3).toEqual({ result: 30 })
  })

  it("should return error for unknown node type", async () => {
    const flow: Flow = {
      id: "test",
      name: "Test Flow",
      nodes: [{ id: "n1", type: "unknown_type", position: { x: 0, y: 0 } }],
      edges: [],
    }
    const result = await executeFlow(flow)
    expect(result.status).toBe("error")
    expect(result.error).toContain("Unknown node type")
  })

  it("should pause on async action node", async () => {
    const flow: Flow = {
      id: "test",
      name: "Test Flow",
      nodes: [
        { id: "n1", type: "trigger", position: { x: 0, y: 0 } },
        {
          id: "n2",
          type: "action",
          position: { x: 100, y: 0 },
          data: { action: "send_email" },
        },
        {
          id: "n3",
          type: "transform",
          position: { x: 200, y: 0 },
          data: { field: "result", operation: "set", value: "done" },
        },
      ],
      edges: [
        { id: "e1", source: "n1", target: "n2" },
        { id: "e2", source: "n2", target: "n3" },
      ],
    }

    const result = await executeFlow(flow, { message: "test" })
    expect(result.status).toBe("waiting")
    expect(result.waitingNodeId).toBe("n2")
    expect(result.context.node_outputs.n2.status).toBe("pending")
  })

  it("should pause on loop node", async () => {
    const flow: Flow = {
      id: "test",
      name: "Test Flow",
      nodes: [
        { id: "n1", type: "trigger", position: { x: 0, y: 0 } },
        {
          id: "n2",
          type: "loop",
          position: { x: 100, y: 0 },
          data: { maxIterations: 3, action: "process" },
        },
      ],
      edges: [{ id: "e1", source: "n1", target: "n2" }],
    }

    const result = await executeFlow(flow, { item: "test" })
    expect(result.status).toBe("waiting")
    expect(result.waitingNodeId).toBe("n2")
    expect(result.context.node_outputs.n2.iteration).toBe(1)
  })

  it("should handle fork and join", async () => {
    const flow: Flow = {
      id: "test",
      name: "Test Flow",
      nodes: [
        { id: "n1", type: "trigger", position: { x: 0, y: 0 } },
        {
          id: "n2",
          type: "fork",
          position: { x: 100, y: 0 },
          data: { branches: [{ id: "branch_a" }, { id: "branch_b" }] },
        },
        {
          id: "n3",
          type: "transform",
          position: { x: 200, y: 0 },
          data: { field: "result", operation: "set", value: "A" },
        },
        {
          id: "n4",
          type: "transform",
          position: { x: 200, y: 100 },
          data: { field: "result", operation: "set", value: "B" },
        },
        {
          id: "n5",
          type: "join",
          position: { x: 300, y: 50 },
          data: { mode: "all" },
        },
      ],
      edges: [
        { id: "e1", source: "n1", target: "n2" },
        { id: "e2", source: "n2", target: "n3", label: "branch_a" },
        { id: "e3", source: "n2", target: "n4", label: "branch_b" },
        { id: "e4", source: "n3", target: "n5" },
        { id: "e5", source: "n4", target: "n5" },
      ],
    }

    const result = await executeFlow(flow, { data: "test" })
    expect(result.status).toBe("completed")
    expect(result.context.node_outputs.n2.status).toBe("forked")
    expect(result.context.node_outputs.n3).toEqual({ result: "A" })
    expect(result.context.node_outputs.n4).toEqual({ result: "B" })
    expect(result.context.node_outputs.n5.status).toBe("completed")
  })
})
