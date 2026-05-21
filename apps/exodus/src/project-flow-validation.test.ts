import { describe, expect, it } from "bun:test"
import { validateProjectFlow } from "./project-flow-validation"
import { FlowKind } from "./types/flow"

describe("project flow validation", () => {
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

  it("accepts valid call nodes backed by query or mutation procedures", () => {
    const result = validateProjectFlow({
      kind: FlowKind.flow,
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
      procedureCatalog,
    })

    expect(result).toEqual({ valid: true, errors: [] })
  })

  it("requires module and procedure on call nodes", () => {
    const result = validateProjectFlow({
      kind: FlowKind.flow,
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
          data: { nodeType: "call", module: "data" },
        },
      ],
      edges: [{ id: "e1", source: "trigger", target: "call" }],
      procedureCatalog,
    })

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Call node "call" must specify module and procedure')
  })

  it("rejects subscriptions as callable procedures", () => {
    const result = validateProjectFlow({
      kind: FlowKind.flow,
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
          data: { nodeType: "call", module: "data", procedure: "itemCreated" },
        },
      ],
      edges: [{ id: "e1", source: "trigger", target: "call" }],
      procedureCatalog,
    })

    expect(result.valid).toBe(false)
    expect(result.errors).toContain(
      'Node "call" references subscription "data.itemCreated"; use query or mutation',
    )
  })

  it("rejects invalid schedule trigger configuration", () => {
    const result = validateProjectFlow({
      kind: FlowKind.flow,
      nodes: [
        {
          id: "trigger",
          type: "trigger",
          position: { x: 0, y: 0 },
          data: {
            nodeType: "trigger",
            source: { type: "schedule", every: "daily", at: "25:00" },
          },
        },
      ],
      edges: [],
      procedureCatalog,
    })

    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Schedule trigger has invalid every value "daily"')
    expect(result.errors).toContain('Schedule trigger has invalid at value "25:00"')
  })

  it("validates trigger source directly from trigger node", () => {
    const result = validateProjectFlow({
      kind: FlowKind.flow,
      nodes: [
        {
          id: "trigger",
          type: "trigger",
          position: { x: 0, y: 0 },
          data: {
            nodeType: "trigger",
            source: { type: "event", event: "" },
          },
        },
      ],
      edges: [],
      procedureCatalog,
    })

    expect(result.valid).toBe(false)
    expect(result.errors).toContain("Trigger event source must not be empty")
  })

  it("validates dotted event sources against subscription metadata", () => {
    const result = validateProjectFlow({
      kind: FlowKind.flow,
      nodes: [
        {
          id: "trigger",
          type: "trigger",
          position: { x: 0, y: 0 },
          data: {
            nodeType: "trigger",
            source: { type: "event", event: "data.listCollections" },
          },
        },
      ],
      edges: [],
      procedureCatalog,
    })

    expect(result.valid).toBe(false)
    expect(result.errors).toContain(
      'Trigger event source "data.listCollections" must reference a subscription',
    )
  })
})
