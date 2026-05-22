import { describe, expect, it } from "bun:test"
import { runProjectFlowPreview } from "./project-flow-preview"
import { FlowKind } from "./types/flow"

describe("project flow preview", () => {
  it("executes pure nodes through the selected branch", () => {
    const result = runProjectFlowPreview({
      kind: FlowKind.flow,
      triggerData: { count: 4 },
      nodes: [
        {
          id: "trigger",
          type: "trigger",
          position: { x: 0, y: 0 },
          data: { nodeType: "trigger", source: { type: "manual" } },
        },
        {
          id: "condition",
          type: "condition",
          position: { x: 120, y: 0 },
          data: { nodeType: "condition", field: "count", operator: "gt", value: 3 },
        },
        {
          id: "output",
          type: "output",
          position: { x: 240, y: 0 },
          data: {
            nodeType: "output",
            outputs: {
              allowed: "{{nodes.condition.output.result}}",
            },
          },
        },
      ],
      edges: [
        { id: "e1", source: "trigger", target: "condition" },
        { id: "e2", source: "condition", sourceHandle: "true", target: "output" },
      ],
    })

    expect(result.status).toBe("completed")
    expect(result.executedNodeIds).toEqual(["trigger", "condition", "output"])
    expect(result.nodeStates.condition?.output).toEqual({ result: true })
    expect(result.finalOutput).toEqual({
      status: "completed",
      outputs: { allowed: true },
    })
  })

  it("stops when reaching a procedure call node", () => {
    const result = runProjectFlowPreview({
      kind: FlowKind.flow,
      triggerData: { count: 1 },
      nodes: [
        {
          id: "trigger",
          type: "trigger",
          position: { x: 0, y: 0 },
          data: { nodeType: "trigger", source: { type: "manual" } },
        },
        {
          id: "call",
          type: "call",
          position: { x: 120, y: 0 },
          data: { nodeType: "call", module: "data", procedure: "createItem" },
        },
      ],
      edges: [{ id: "e1", source: "trigger", target: "call" }],
    })

    expect(result.status).toBe("failed")
    expect(result.stoppedNodeId).toBe("call")
    expect(result.error).toBe("Procedure calls are not executed in design-time preview")
    expect(result.nodeStates.call?.status).toBe("failed")
  })

  it("resolves trigger and node output templates in output nodes", () => {
    const result = runProjectFlowPreview({
      kind: FlowKind.subflow,
      triggerData: { inputs: { user: { name: "Alice" } } },
      nodes: [
        {
          id: "input",
          type: "input",
          position: { x: 0, y: 0 },
          data: { nodeType: "input" },
        },
        {
          id: "transform",
          type: "transform",
          position: { x: 120, y: 0 },
          data: { nodeType: "transform", field: "user.name", operation: "append", value: "!" },
        },
        {
          id: "output",
          type: "output",
          position: { x: 240, y: 0 },
          data: {
            nodeType: "output",
            outputs: {
              raw: "{{trigger.inputs.user.name}}",
              excited: "{{nodes.transform.output.result}}",
            },
          },
        },
      ],
      edges: [
        { id: "e1", source: "input", target: "transform" },
        { id: "e2", source: "transform", target: "output" },
      ],
    })

    expect(result.status).toBe("completed")
    expect(result.finalOutput).toEqual({
      status: "completed",
      outputs: {
        raw: "Alice",
        excited: "Alice!",
      },
    })
  })

  it("builds mapped payloads before output nodes", () => {
    const result = runProjectFlowPreview({
      kind: FlowKind.flow,
      triggerData: { title: "Task", status: "active" },
      nodes: [
        {
          id: "trigger",
          type: "trigger",
          position: { x: 0, y: 0 },
          data: { nodeType: "trigger", source: { type: "manual" } },
        },
        {
          id: "map",
          type: "map",
          position: { x: 120, y: 0 },
          data: {
            nodeType: "map",
            mappings: [
              { sourcePath: "title", targetPath: "data.title" },
              { sourcePath: "status", targetPath: "data.status" },
            ],
          },
        },
        {
          id: "output",
          type: "output",
          position: { x: 240, y: 0 },
          data: {
            nodeType: "output",
            outputs: {
              title: "{{nodes.map.output.data.title}}",
              status: "{{nodes.map.output.data.status}}",
            },
          },
        },
      ],
      edges: [
        { id: "e1", source: "trigger", target: "map" },
        { id: "e2", source: "map", target: "output" },
      ],
    })

    expect(result.status).toBe("completed")
    expect(result.nodeStates.map?.output).toEqual({
      data: {
        title: "Task",
        status: "active",
      },
    })
    expect(result.finalOutput).toEqual({
      status: "completed",
      outputs: {
        title: "Task",
        status: "active",
      },
    })
  })

  it("supports whole-object mappings in map nodes", () => {
    const result = runProjectFlowPreview({
      kind: FlowKind.flow,
      triggerData: {
        profile: {
          name: "Alice",
          status: "active",
        },
      },
      nodes: [
        {
          id: "trigger",
          type: "trigger",
          position: { x: 0, y: 0 },
          data: { nodeType: "trigger", source: { type: "manual" } },
        },
        {
          id: "map",
          type: "map",
          position: { x: 120, y: 0 },
          data: {
            nodeType: "map",
            mappings: [{ sourcePath: "profile", targetPath: "data.profile" }],
          },
        },
        {
          id: "output",
          type: "output",
          position: { x: 240, y: 0 },
          data: {
            nodeType: "output",
            outputs: {
              profile: "{{nodes.map.output.data.profile}}",
            },
          },
        },
      ],
      edges: [
        { id: "e1", source: "trigger", target: "map" },
        { id: "e2", source: "map", target: "output" },
      ],
    })

    expect(result.status).toBe("completed")
    expect(result.nodeStates.map?.output).toEqual({
      data: {
        profile: {
          name: "Alice",
          status: "active",
        },
      },
    })
    expect(result.finalOutput).toEqual({
      status: "completed",
      outputs: {
        profile: {
          name: "Alice",
          status: "active",
        },
      },
    })
  })
})
