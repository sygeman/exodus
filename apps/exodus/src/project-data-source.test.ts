import { describe, expect, it } from "bun:test"
import {
  buildProjectDataManifest,
  normalizeProjectDataFields,
  toProjectDataCollectionManifest,
} from "./project-data-source"

describe("project data source", () => {
  it("normalizes manifest fields from source JSON", () => {
    expect(
      normalizeProjectDataFields([
        { name: "title", type: "string", required: true },
        { name: "id", type: "uuid", special: "uuid", system: true, readonly: true },
        { invalid: true },
      ]),
    ).toEqual([
      { name: "title", type: "string", required: true },
      { name: "id", type: "uuid", special: "uuid", system: true, readonly: true },
    ])
  })

  it("forces canonical names for generated fields", () => {
    expect(
      normalizeProjectDataFields([
        { name: "custom_uuid", type: "uuid", special: "uuid", system: true, readonly: true },
        { name: "created", type: "timestamp", special: "date-created" },
        { name: "updated", type: "timestamp", special: "date-updated" },
      ]),
    ).toEqual([
      { name: "id", type: "uuid", special: "uuid", system: true, readonly: true },
      { name: "created_at", type: "timestamp", special: "date-created" },
      { name: "updated_at", type: "timestamp", special: "date-updated" },
    ])
  })

  it("normalizes relation config from legacy field options", () => {
    expect(
      normalizeProjectDataFields([
        {
          name: "author",
          type: "relation",
          options: { collection: "users", kind: "many", mode: "one" },
        },
      ]),
    ).toEqual([
      {
        name: "author",
        type: "relation",
        relation: { collection: "users", kind: "many" },
        options: { mode: "one" },
      },
    ])
  })

  it("builds collection manifest from source item", () => {
    expect(
      toProjectDataCollectionManifest({
        id: "local-1",
        data: {
          manifest_id: "ideas",
          name: "Ideas",
          singleton: true,
          description: "Project ideas",
          fields: [
            { name: "title", type: "string", required: true },
            { name: "author", type: "relation", relation: { collection: "users" } },
          ],
        },
      }),
    ).toEqual({
      id: "ideas",
      name: "Ideas",
      singleton: true,
      description: "Project ideas",
      fields: [
        { name: "title", type: "string", required: true },
        { name: "author", type: "relation", relation: { collection: "users" } },
      ],
      labels: undefined,
      icon: undefined,
    })
  })

  it("builds the full data manifest", () => {
    expect(
      buildProjectDataManifest([
        {
          id: "local-1",
          data: {
            manifest_id: "ideas",
            name: "Ideas",
            fields: [{ name: "title", type: "string" }],
          },
        },
      ]),
    ).toEqual({
      collections: [
        {
          id: "ideas",
          name: "Ideas",
          singleton: undefined,
          fields: [{ name: "title", type: "string" }],
          labels: undefined,
          description: undefined,
          icon: undefined,
        },
      ],
    })
  })
})
