import { describe, expect, it } from "bun:test"
import type { NodeContractField } from "./flow-node-contract"
import {
  canMapFieldToTarget,
  countCoveredTargetPaths,
  findClosestTargetMapping,
  isTargetPathSatisfied,
  replaceLiteralMapping,
  replaceSourceMapping,
} from "./flow-map-editor"

function field(name: string, type: string, children: NodeContractField[] = []): NodeContractField {
  return {
    name,
    type,
    required: true,
    enumValues: [],
    constraints: [],
    children,
    note: null,
  }
}

describe("flow map editor helpers", () => {
  it("counts descendant leaf paths as covered by a whole-object mapping", () => {
    const mappings = [
      { kind: "source" as const, sourcePath: "profile", targetPath: "data.profile" },
    ]

    expect(findClosestTargetMapping(mappings, "data.profile.name")?.targetPath).toBe("data.profile")
    expect(
      countCoveredTargetPaths(mappings, ["data.profile.name", "data.profile.status", "data.title"]),
    ).toBe(2)
  })

  it("replaces conflicting ancestor and descendant mappings", () => {
    const withParent = replaceSourceMapping([], "data.profile", "profile")
    expect(withParent).toEqual([
      { kind: "source", sourcePath: "profile", targetPath: "data.profile" },
    ])

    const withChild = replaceSourceMapping(withParent, "data.profile.name", "title")
    expect(withChild).toEqual([
      { kind: "source", sourcePath: "title", targetPath: "data.profile.name" },
    ])

    const parentAgain = replaceSourceMapping(withChild, "data.profile", "profile")
    expect(parentAgain).toEqual([
      { kind: "source", sourcePath: "profile", targetPath: "data.profile" },
    ])
  })

  it("replaces collection target with a literal mapping", () => {
    const next = replaceLiteralMapping(
      [{ kind: "source", sourcePath: "payload.collectionId", targetPath: "collection_id" }],
      "collection_id",
      "ideas",
    )

    expect(next).toEqual([
      { kind: "literal", sourcePath: "", targetPath: "collection_id", literal: "ideas" },
    ])
  })

  it("treats open object targets as satisfied when nested target paths are mapped", () => {
    const mappings = [
      {
        kind: "source" as const,
        sourcePath: "status",
        targetPath: "filter.status._eq",
      },
    ]

    expect(isTargetPathSatisfied(mappings, "filter")).toBe(true)
    expect(countCoveredTargetPaths(mappings, ["filter", "locale"])).toBe(1)
  })

  it("only allows whole-object and whole-array mappings for matching container targets", () => {
    const objectField = field("profile", "object", [field("name", "string")])
    const arrayField = field("items", "array", [field("item", "object", [field("id", "string")])])
    const stringField = field("title", "string")
    const unknownField = field("payload", "unknown")

    expect(canMapFieldToTarget(objectField, objectField)).toBe(true)
    expect(canMapFieldToTarget(arrayField, arrayField)).toBe(true)
    expect(canMapFieldToTarget(stringField, objectField)).toBe(false)
    expect(canMapFieldToTarget(objectField, stringField)).toBe(false)
    expect(canMapFieldToTarget(objectField, unknownField)).toBe(true)
  })
})
