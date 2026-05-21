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
        { name: "itemCreated", kind: "subscription" },
        { name: "createItem", kind: "mutation" },
        { name: "listCollections", kind: "query" },
      ],
    },
    {
      module: "events",
      procedures: [{ name: "tick", kind: "subscription" }],
    },
  ])

  it("normalizes and sorts catalog entries", () => {
    expect(catalog).toEqual([
      {
        module: "data",
        procedures: [
          { name: "createItem", kind: "mutation" },
          { name: "itemCreated", kind: "subscription" },
          { name: "listCollections", kind: "query" },
        ],
      },
      {
        module: "events",
        procedures: [{ name: "tick", kind: "subscription" }],
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
    expect(isCallableProcedure({ name: "listCollections", kind: "query" })).toBe(true)
    expect(isCallableProcedure({ name: "createItem", kind: "mutation" })).toBe(true)
    expect(isCallableProcedure({ name: "itemCreated", kind: "subscription" })).toBe(false)
  })
})
