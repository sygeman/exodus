import { describe, it, expect } from "bun:test"
import { collectionSchema, itemSchema } from "./schemas"

describe("collectionSchema", () => {
  it("should validate a valid collection", () => {
    const result = collectionSchema.safeParse({
      id: "123",
      name: "Users",
      slug: "users",
      fields: [],
    })
    expect(result.success).toBe(true)
  })

  it("should validate with optional meta", () => {
    const result = collectionSchema.safeParse({
      id: "123",
      name: "Users",
      slug: "users",
      fields: [],
      meta: { key: "value" },
    })
    expect(result.success).toBe(true)
  })

  it("should reject missing required fields", () => {
    const result = collectionSchema.safeParse({
      id: "123",
      name: "Users",
    })
    expect(result.success).toBe(false)
  })

  it("should reject invalid field types", () => {
    const result = collectionSchema.safeParse({
      id: "123",
      name: "Users",
      slug: "users",
      fields: [{ id: "1", collection_id: "123", name: "email", type: "invalid" }],
    })
    expect(result.success).toBe(false)
  })
})

describe("itemSchema", () => {
  it("should validate a valid item", () => {
    const result = itemSchema.safeParse({
      id: "123",
      collection_id: "col1",
      data: { title: "Test" },
      created_at: Date.now(),
      updated_at: Date.now(),
    })
    expect(result.success).toBe(true)
  })

  it("should reject missing required fields", () => {
    const result = itemSchema.safeParse({
      id: "123",
      data: { title: "Test" },
    })
    expect(result.success).toBe(false)
  })

  it("should reject wrong types", () => {
    const result = itemSchema.safeParse({
      id: "123",
      collection_id: "col1",
      data: "not an object",
      created_at: Date.now(),
      updated_at: Date.now(),
    })
    expect(result.success).toBe(false)
  })
})
