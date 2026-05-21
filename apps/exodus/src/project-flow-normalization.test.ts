import { describe, expect, it } from "bun:test"
import { normalizeProjectFlowGraph } from "./project-flow-normalization"
import { FlowKind } from "./types/flow"

describe("project flow normalization", () => {
  const inputSchema = { mode: "json-schema" as const, schema: { type: "object" } }
  const outputSchema = { mode: "json-schema" as const, schema: { type: "object" } }
  const noInputSchema = { mode: "none" as const }

  const procedureCatalog = [
    {
      module: "data",
      procedures: [
        {
          name: "listCollections",
          kind: "query" as const,
          inputSchema,
          outputSchema,
        },
        {
          name: "createItem",
          kind: "mutation" as const,
          inputSchema,
          outputSchema,
        },
        {
          name: "itemCreated",
          kind: "subscription" as const,
          inputSchema: noInputSchema,
          outputSchema,
        },
      ],
    },
  ]

  it("materializes a trigger node when graph is missing one", () => {
    const normalized = normalizeProjectFlowGraph({
      kind: FlowKind.flow,
      nodes: [
        {
          id: "condition",
          type: "condition",
          position: { x: 120, y: 0 },
          data: { nodeType: "condition", field: "status", operator: "eq", value: "done" },
        },
      ],
      edges: [],
    })

    expect(normalized.trigger).toBeNull()
    expect(normalized.nodes[0]?.type).toBe("trigger")
    expect(normalized.nodes[0]?.data.source).toEqual({ type: "manual" })
    expect(normalized.edges).toEqual([
      { id: "trigger-condition", source: "trigger", target: "condition" },
    ])
  })

  it("normalizes call node procedure fields", () => {
    const normalized = normalizeProjectFlowGraph({
      kind: FlowKind.flow,
      procedureCatalog,
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
          data: { nodeType: "call", module: "data", procedure: "listCollections" },
        },
      ],
      edges: [{ id: "e1", source: "trigger", target: "call" }],
    })

    const node = normalized.nodes.find((entry) => entry.id === "call")
    expect(node?.type).toBe("call")
    expect(node?.data.module).toBe("data")
    expect(node?.data.procedure).toBe("listCollections")
  })
})
