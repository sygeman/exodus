import { describe, expect, it } from "bun:test"
import { buildNodeContract } from "./flow-node-contract"
import { FlowKind } from "./types/flow"

describe("flow node contract", () => {
  it("builds a procedure-backed contract from serialized schemas", () => {
    const contract = buildNodeContract({
      node: {
        id: "call-1",
        type: "call",
        data: {
          type: "call",
          module: "data",
          procedure: "createItem",
        },
      },
      procedureCatalog: [
        {
          module: "data",
          procedures: [
            {
              name: "createItem",
              kind: "mutation",
              inputSchema: {
                mode: "json-schema",
                schema: {
                  type: "object",
                  required: ["collection_id", "data"],
                  properties: {
                    collection_id: { type: "string", format: "uuid" },
                    data: { type: "object" },
                  },
                },
              },
              outputSchema: {
                mode: "json-schema",
                schema: {
                  type: "object",
                  required: ["id"],
                  properties: {
                    id: { type: "string", format: "uuid" },
                  },
                },
              },
            },
          ],
        },
      ],
    })

    expect(contract.reference).toBe("data.createItem")
    expect(contract.input.note).toBeNull()
    expect(contract.input.fields).toEqual([
      {
        name: "collection_id",
        type: "string",
        required: true,
        enumValues: [],
        constraints: ["format: uuid"],
        children: [],
        note: null,
      },
      {
        name: "data",
        type: "object",
        required: true,
        enumValues: [],
        constraints: [],
        children: [],
        note: null,
      },
    ])
    expect(contract.validation.note).toBe(
      "Input payload is checked against the procedure schema before execution.",
    )
    expect(contract.validation.rules).toContain("Required fields: collection_id, data")
    expect(contract.validation.rules).toContain("collection_id: format: uuid")
    expect(contract.output.fields).toEqual([
      {
        name: "id",
        type: "string",
        required: true,
        enumValues: [],
        constraints: ["format: uuid"],
        children: [],
        note: null,
      },
    ])
  })

  it("reads child output mapping for subflow nodes", () => {
    const contract = buildNodeContract({
      node: {
        id: "subflow-1",
        type: "subflow",
        data: {
          type: "subflow",
          flow_id: "child-flow",
        },
      },
      procedureCatalog: [],
      projectFlows: [
        {
          id: "child-flow",
          data: {
            name: "Child flow",
            kind: FlowKind.subflow,
            valid: true,
            validation_errors: [],
            nodes: [
              {
                id: "input",
                type: "input",
                position: { x: 0, y: 0 },
                data: { nodeType: "input" },
              },
              {
                id: "output",
                type: "output",
                position: { x: 120, y: 0 },
                data: {
                  nodeType: "output",
                  outputs: {
                    approved: "{{nodes.check.output.result}}",
                    user: "{{trigger.inputs.user}}",
                  },
                },
              },
            ],
            edges: [{ id: "e1", source: "input", target: "output" }],
          },
        },
      ],
    })

    expect(contract.reference).toBe("Child flow")
    expect(contract.input.fields).toEqual([
      {
        name: "payload",
        type: "object",
        required: true,
        enumValues: [],
        constraints: [],
        children: [],
        note: null,
      },
    ])
    expect(contract.output.note).toBe("Fields returned from the child flow.")
    expect(contract.output.fields).toEqual([
      {
        name: "approved",
        type: "unknown",
        required: true,
        enumValues: [],
        constraints: [],
        children: [],
        note: "{{nodes.check.output.result}}",
      },
      {
        name: "user",
        type: "unknown",
        required: true,
        enumValues: [],
        constraints: [],
        children: [],
        note: "{{trigger.inputs.user}}",
      },
    ])
    expect(contract.validation.note).toBe(
      "The child flow is resolved and can expose its output fields here.",
    )
    expect(contract.validation.rules).toContain("Flow ID: child-flow")
    expect(contract.validation.rules).toContain("Kind: subflow")
  })

  it("preserves enum types and nested field structure", () => {
    const contract = buildNodeContract({
      node: {
        id: "call-2",
        type: "call",
        data: {
          type: "call",
          module: "data",
          procedure: "saveProfile",
        },
      },
      procedureCatalog: [
        {
          module: "data",
          procedures: [
            {
              name: "saveProfile",
              kind: "mutation",
              inputSchema: {
                mode: "json-schema",
                schema: {
                  type: "object",
                  required: ["status", "profile"],
                  properties: {
                    status: { type: "string", enum: ["draft", "active"] },
                    profile: {
                      type: "object",
                      required: ["name", "roles"],
                      properties: {
                        name: { type: "string" },
                        roles: {
                          type: "array",
                          items: {
                            type: "object",
                            required: ["code"],
                            properties: {
                              code: { type: "string", enum: ["admin", "editor"] },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
              outputSchema: {
                mode: "json-schema",
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean" },
                  },
                },
              },
            },
          ],
        },
      ],
    })

    expect(contract.input.fields).toEqual([
      {
        name: "status",
        type: "string",
        required: true,
        enumValues: ["draft", "active"],
        constraints: [],
        children: [],
        note: null,
      },
      {
        name: "profile",
        type: "object",
        required: true,
        enumValues: [],
        constraints: [],
        children: [
          {
            name: "name",
            type: "string",
            required: true,
            enumValues: [],
            constraints: [],
            children: [],
            note: null,
          },
          {
            name: "roles",
            type: "array",
            required: true,
            enumValues: [],
            constraints: [],
            children: [
              {
                name: "code",
                type: "string",
                required: true,
                enumValues: ["admin", "editor"],
                constraints: [],
                children: [],
                note: null,
              },
            ],
            note: "Each item contains its own nested fields.",
          },
        ],
        note: null,
      },
    ])
  })
})
