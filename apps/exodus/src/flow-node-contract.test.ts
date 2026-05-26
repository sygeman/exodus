import { describe, expect, it } from "bun:test"
import { buildNodeContract } from "./flow-node-contract"
import type { DataManifest } from "./project-manifest-schemas"
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

  it("uses project data schema for createItem when collection_id is fixed in the incoming map", () => {
    const contract = buildNodeContract({
      node: {
        id: "call-create",
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
                    collection_id: { type: "string" },
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
                    id: { type: "string" },
                  },
                },
              },
            },
          ],
        },
      ],
      projectDataManifest: {
        collections: [
          {
            id: "posts",
            name: "Posts",
            fields: [
              { name: "title", type: "string", required: true },
              {
                name: "status",
                type: "string",
                default: "draft",
                options: { items: ["draft", "published"] },
              },
              {
                name: "author",
                type: "relation",
                relation: { collection: "users" },
              },
            ],
          },
        ],
      },
      graphNodes: [
        {
          id: "map-1",
          type: "map",
          data: {
            type: "map",
            mappings: [
              { kind: "literal", sourcePath: "", targetPath: "collection_id", literal: "posts" },
            ],
          },
        },
        {
          id: "call-create",
          type: "call",
          data: {
            type: "call",
            module: "data",
            procedure: "createItem",
          },
        },
      ],
      graphEdges: [{ source: "map-1", target: "call-create" }],
    })

    expect(contract.validation.rules).toContain("Collection schema: posts")
    expect(contract.input.fields).toEqual([
      {
        name: "collection_id",
        type: "string",
        required: true,
        enumValues: [],
        constraints: [],
        children: [],
        note: null,
      },
      {
        name: "data",
        type: "object",
        required: true,
        enumValues: [],
        constraints: [],
        note: 'Fields from project collection "posts".',
        children: [
          {
            name: "title",
            type: "string",
            required: true,
            enumValues: [],
            constraints: [],
            children: [],
            note: null,
          },
          {
            name: "status",
            type: "string",
            required: false,
            enumValues: ["draft", "published"],
            constraints: [],
            children: [],
            note: "Default: draft",
          },
          {
            name: "author",
            type: "relation",
            required: false,
            enumValues: [],
            constraints: [],
            children: [],
            note: "Target collection: users",
          },
        ],
      },
    ])
  })

  it("omits generated project fields from data call input and keeps them in item output", () => {
    const projectDataManifest = {
      collections: [
        {
          id: "posts",
          name: "Posts",
          fields: [
            { name: "id", type: "uuid", special: "uuid", system: true, readonly: true },
            {
              name: "created_at",
              type: "timestamp",
              special: "date-created",
              system: true,
              readonly: true,
            },
            { name: "title", type: "string", required: true },
          ],
        },
      ],
    } satisfies DataManifest

    const procedureCatalog = [
      {
        module: "data",
        procedures: [
          {
            name: "createItem",
            kind: "mutation" as const,
            inputSchema: {
              mode: "json-schema" as const,
              schema: {
                type: "object",
                required: ["collection_id", "data"],
                properties: {
                  collection_id: { type: "string" },
                  data: { type: "object" },
                },
              },
            },
            outputSchema: {
              mode: "json-schema" as const,
              schema: {
                type: "object",
                required: ["id"],
                properties: { id: { type: "string" } },
              },
            },
          },
          {
            name: "queryItems",
            kind: "query" as const,
            inputSchema: {
              mode: "json-schema" as const,
              schema: {
                type: "object",
                required: ["collection_id"],
                properties: { collection_id: { type: "string" } },
              },
            },
            outputSchema: {
              mode: "json-schema" as const,
              schema: {
                type: "object",
                required: ["items"],
                properties: { items: { type: "array", items: { type: "object" } } },
              },
            },
          },
        ],
      },
    ]

    const createContract = buildNodeContract({
      node: {
        id: "call-create",
        type: "call",
        data: {
          type: "call",
          module: "data",
          procedure: "createItem",
          collection_id: "posts",
        },
      },
      procedureCatalog,
      projectDataManifest,
    })

    expect(createContract.input.fields.find((field) => field.name === "data")?.children).toEqual([
      {
        name: "title",
        type: "string",
        required: true,
        enumValues: [],
        constraints: [],
        children: [],
        note: null,
      },
    ])

    const queryContract = buildNodeContract({
      node: {
        id: "call-query",
        type: "call",
        data: {
          type: "call",
          module: "data",
          procedure: "queryItems",
          collection_id: "posts",
        },
      },
      procedureCatalog,
      projectDataManifest,
    })

    const itemDataField = queryContract.output.fields[0]?.children.find(
      (field) => field.name === "data",
    )

    expect(itemDataField?.children.map((field) => field.name)).toEqual([
      "id",
      "created_at",
      "title",
    ])
    expect(itemDataField?.children.find((field) => field.name === "id")?.note).toBe(
      "Generated UUID",
    )
    expect(itemDataField?.children.find((field) => field.name === "created_at")?.note).toBe(
      "Generated on create",
    )
  })

  it("uses project data schema for getSingleton output when collection_id is fixed in the incoming map", () => {
    const contract = buildNodeContract({
      node: {
        id: "call-singleton",
        type: "call",
        data: {
          type: "call",
          module: "data",
          procedure: "getSingleton",
        },
      },
      procedureCatalog: [
        {
          module: "data",
          procedures: [
            {
              name: "getSingleton",
              kind: "query",
              inputSchema: {
                mode: "json-schema",
                schema: {
                  type: "object",
                  required: ["collection_id"],
                  properties: {
                    collection_id: { type: "string" },
                  },
                },
              },
              outputSchema: {
                mode: "json-schema",
                schema: {
                  type: "object",
                  required: ["item"],
                  properties: {
                    item: {
                      anyOf: [
                        {
                          type: "object",
                          required: ["id", "collection_id", "data", "created_at", "updated_at"],
                          properties: {
                            id: { type: "string" },
                            collection_id: { type: "string" },
                            data: { type: "object" },
                            created_at: { type: "number" },
                            updated_at: { type: "number" },
                          },
                        },
                        { type: "null" },
                      ],
                    },
                  },
                },
              },
            },
          ],
        },
      ],
      projectDataManifest: {
        collections: [
          {
            id: "settings",
            name: "Settings",
            singleton: true,
            fields: [
              { name: "locale", type: "string" },
              { name: "dark", type: "boolean", default: false },
            ],
          },
        ],
      },
      graphNodes: [
        {
          id: "map-1",
          type: "map",
          data: {
            type: "map",
            mappings: [
              {
                kind: "literal",
                sourcePath: "",
                targetPath: "collection_id",
                literal: "settings",
              },
            ],
          },
        },
        {
          id: "call-singleton",
          type: "call",
          data: {
            type: "call",
            module: "data",
            procedure: "getSingleton",
          },
        },
      ],
      graphEdges: [{ source: "map-1", target: "call-singleton" }],
    })

    expect(contract.validation.rules).toContain("Collection schema: settings")
    expect(contract.output.fields).toEqual([
      {
        name: "item",
        type: "object",
        required: true,
        enumValues: [],
        constraints: [],
        note: "Can be empty when the singleton item does not exist yet.",
        children: [
          {
            name: "id",
            type: "string",
            required: true,
            enumValues: [],
            constraints: [],
            children: [],
            note: null,
          },
          {
            name: "collection_id",
            type: "string",
            required: true,
            enumValues: ["settings"],
            constraints: [],
            children: [],
            note: null,
          },
          {
            name: "schema_version",
            type: "number",
            required: false,
            enumValues: [],
            constraints: [],
            children: [],
            note: null,
          },
          {
            name: "source",
            type: "string",
            required: false,
            enumValues: [],
            constraints: [],
            children: [],
            note: null,
          },
          {
            name: "data",
            type: "object",
            required: true,
            enumValues: [],
            constraints: [],
            note: 'Fields from project collection "settings".',
            children: [
              {
                name: "locale",
                type: "string",
                required: false,
                enumValues: [],
                constraints: [],
                children: [],
                note: null,
              },
              {
                name: "dark",
                type: "boolean",
                required: false,
                enumValues: [],
                constraints: [],
                children: [],
                note: "Default: false",
              },
            ],
          },
          {
            name: "created_at",
            type: "number",
            required: true,
            enumValues: [],
            constraints: [],
            children: [],
            note: null,
          },
          {
            name: "updated_at",
            type: "number",
            required: true,
            enumValues: [],
            constraints: [],
            children: [],
            note: null,
          },
          {
            name: "deleted_at",
            type: "number",
            required: false,
            enumValues: [],
            constraints: [],
            children: [],
            note: null,
          },
        ],
      },
    ])
  })
})
