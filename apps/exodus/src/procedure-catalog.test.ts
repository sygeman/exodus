import { describe, expect, it } from "bun:test"
import {
  isCallableProcedure,
  listCallableModuleOptions,
  listCallableProcedureOptions,
  listSubscriptionProcedureOptions,
  normalizeProcedureCatalog,
} from "./procedure-catalog"

describe("procedure catalog helpers", () => {
  const catalog = normalizeProcedureCatalog([
    {
      module: "data",
      procedures: [
        {
          name: "itemCreated",
          kind: "subscription",
          inputSchema: { mode: "none" },
          outputSchema: { mode: "json-schema", schema: { type: "object" } },
        },
        {
          name: "createItem",
          kind: "mutation",
          inputSchema: { mode: "json-schema", schema: { type: "object" } },
          outputSchema: { mode: "json-schema", schema: { type: "object" } },
        },
        {
          name: "listCollections",
          kind: "query",
          inputSchema: { mode: "none" },
          outputSchema: { mode: "json-schema", schema: { type: "object" } },
        },
      ],
    },
    {
      module: "events",
      procedures: [
        {
          name: "tick",
          kind: "subscription",
          inputSchema: { mode: "none" },
          outputSchema: { mode: "json-schema", schema: { type: "object" } },
        },
      ],
    },
  ])

  it("normalizes and sorts catalog entries", () => {
    expect(catalog).toEqual([
      {
        module: "data",
        procedures: [
          {
            name: "createItem",
            kind: "mutation",
            inputSchema: { mode: "json-schema", schema: { type: "object" } },
            outputSchema: { mode: "json-schema", schema: { type: "object" } },
          },
          {
            name: "itemCreated",
            kind: "subscription",
            inputSchema: { mode: "none" },
            outputSchema: { mode: "json-schema", schema: { type: "object" } },
          },
          {
            name: "listCollections",
            kind: "query",
            inputSchema: { mode: "none" },
            outputSchema: { mode: "json-schema", schema: { type: "object" } },
          },
        ],
      },
      {
        module: "events",
        procedures: [
          {
            name: "tick",
            kind: "subscription",
            inputSchema: { mode: "none" },
            outputSchema: { mode: "json-schema", schema: { type: "object" } },
          },
        ],
      },
    ])
  })

  it("filters callable modules for call-node editor options", () => {
    expect(listCallableModuleOptions(catalog)).toEqual([{ label: "data", value: "data" }])
  })

  it("filters callable procedures within a selected module", () => {
    expect(listCallableProcedureOptions(catalog, "data")).toEqual([
      { label: "createItem (mutation)", value: "createItem" },
      { label: "listCollections (query)", value: "listCollections" },
    ])
    expect(listCallableProcedureOptions(catalog, "events")).toEqual([])
  })

  it("lists subscription procedure refs for trigger event sources", () => {
    expect(listSubscriptionProcedureOptions(catalog)).toEqual([
      { label: "data.itemCreated", value: "data.itemCreated" },
      { label: "events.tick", value: "events.tick" },
    ])
  })

  it("marks only queries and mutations as callable", () => {
    expect(
      isCallableProcedure({
        name: "listCollections",
        kind: "query",
        inputSchema: { mode: "none" },
        outputSchema: { mode: "json-schema", schema: { type: "object" } },
      }),
    ).toBe(true)
    expect(
      isCallableProcedure({
        name: "createItem",
        kind: "mutation",
        inputSchema: { mode: "json-schema", schema: { type: "object" } },
        outputSchema: { mode: "json-schema", schema: { type: "object" } },
      }),
    ).toBe(true)
    expect(
      isCallableProcedure({
        name: "itemCreated",
        kind: "subscription",
        inputSchema: { mode: "none" },
        outputSchema: { mode: "json-schema", schema: { type: "object" } },
      }),
    ).toBe(false)
  })

  it("drops invalid procedure entries that do not expose schemas", () => {
    expect(
      normalizeProcedureCatalog([
        {
          module: "legacy",
          procedures: [{ name: "run", kind: "mutation" }],
        },
      ]),
    ).toEqual([{ module: "legacy", procedures: [] }])
  })
})
