import { describe, it, expect } from "bun:test"
import { validateFieldValue, fieldTypes, fieldSchema } from "./fields"

describe("field types", () => {
  it("should have all field types defined", () => {
    expect(fieldTypes).toContain("string")
    expect(fieldTypes).toContain("text")
    expect(fieldTypes).toContain("number")
    expect(fieldTypes).toContain("boolean")
    expect(fieldTypes).toContain("date")
    expect(fieldTypes).toContain("datetime")
    expect(fieldTypes).toContain("json")
    expect(fieldTypes).toContain("file")
    expect(fieldTypes).toContain("image")
    expect(fieldTypes).toContain("video")
    expect(fieldTypes).toContain("relation")
    expect(fieldTypes).toContain("collection")
    expect(fieldTypes).toContain("uuid")
    expect(fieldTypes).toContain("timestamp")
    expect(fieldTypes).toContain("user")
    expect(fieldTypes).toContain("sort")
    expect(fieldTypes).toHaveLength(16)
  })
})

describe("validateFieldValue", () => {
  it("should treat null and undefined as valid for any type", () => {
    for (const type of fieldTypes) {
      expect(validateFieldValue(type, null)).toBe(true)
      expect(validateFieldValue(type, undefined)).toBe(true)
    }
  })

  it("should return false for unknown type", () => {
    expect(validateFieldValue("unknown" as any, "value")).toBe(false)
  })

  describe("string-like types", () => {
    const stringTypes = ["string", "text", "file", "image", "video", "user", "relation"] as const

    for (const type of stringTypes) {
      it(`should validate ${type}`, () => {
        expect(validateFieldValue(type, "hello")).toBe(true)
        expect(validateFieldValue(type, "")).toBe(true)
        expect(validateFieldValue(type, 123)).toBe(false)
        expect(validateFieldValue(type, true)).toBe(false)
        expect(validateFieldValue(type, {})).toBe(false)
      })
    }
  })

  describe("number-like types", () => {
    it("should validate number", () => {
      expect(validateFieldValue("number", 42)).toBe(true)
      expect(validateFieldValue("number", 0)).toBe(true)
      expect(validateFieldValue("number", -1.5)).toBe(true)
      expect(validateFieldValue("number", "42")).toBe(false)
      expect(validateFieldValue("number", true)).toBe(false)
    })

    it("should validate sort", () => {
      expect(validateFieldValue("sort", 1)).toBe(true)
      expect(validateFieldValue("sort", 0)).toBe(true)
      expect(validateFieldValue("sort", -100)).toBe(true)
      expect(validateFieldValue("sort", "1")).toBe(false)
    })
  })

  describe("boolean", () => {
    it("should validate boolean", () => {
      expect(validateFieldValue("boolean", true)).toBe(true)
      expect(validateFieldValue("boolean", false)).toBe(true)
      expect(validateFieldValue("boolean", 0)).toBe(false)
      expect(validateFieldValue("boolean", 1)).toBe(false)
      expect(validateFieldValue("boolean", "true")).toBe(false)
    })
  })

  describe("date", () => {
    it("should validate ISO date strings", () => {
      expect(validateFieldValue("date", "2024-01-15")).toBe(true)
      expect(validateFieldValue("date", "2000-12-31")).toBe(true)
    })

    it("should reject invalid date formats", () => {
      expect(validateFieldValue("date", "2024-1-15")).toBe(false)
      expect(validateFieldValue("date", "not-a-date")).toBe(false)
      expect(validateFieldValue("date", "2024-01-15T10:30:00")).toBe(false)
      expect(validateFieldValue("date", 123)).toBe(false)
    })
  })

  describe("datetime and timestamp", () => {
    it("should validate ISO datetime strings", () => {
      expect(validateFieldValue("datetime", "2024-01-15T10:30:00")).toBe(true)
      expect(validateFieldValue("datetime", "2024-01-15T10:30:00Z")).toBe(true)
      expect(validateFieldValue("datetime", "2024-01-15T10:30:00+05:00")).toBe(true)
    })

    it("should reject invalid datetime formats", () => {
      expect(validateFieldValue("datetime", "2024-01-15")).toBe(false)
      expect(validateFieldValue("datetime", "not-a-datetime")).toBe(false)
      expect(validateFieldValue("datetime", 123)).toBe(false)
    })

    it("should validate timestamp same as datetime", () => {
      expect(validateFieldValue("timestamp", "2024-01-15T10:30:00")).toBe(true)
      expect(validateFieldValue("timestamp", "2024-01-15")).toBe(false)
    })
  })

  describe("uuid", () => {
    it("should validate UUID format", () => {
      expect(validateFieldValue("uuid", "550e8400-e29b-41d4-a716-446655440000")).toBe(true)
      expect(validateFieldValue("uuid", "00000000-0000-0000-0000-000000000000")).toBe(true)
      expect(validateFieldValue("uuid", "FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF")).toBe(true)
    })

    it("should reject invalid UUID formats", () => {
      expect(validateFieldValue("uuid", "not-a-uuid")).toBe(false)
      expect(validateFieldValue("uuid", "550e8400-e29b-41d4-a716")).toBe(false)
      expect(validateFieldValue("uuid", "550e8400e29b41d4a716446655440000")).toBe(false)
      expect(validateFieldValue("uuid", 123)).toBe(false)
    })
  })

  describe("json", () => {
    it("should validate objects and arrays", () => {
      expect(validateFieldValue("json", { key: "value" })).toBe(true)
      expect(validateFieldValue("json", [1, 2, 3])).toBe(true)
      expect(validateFieldValue("json", {})).toBe(true)
      expect(validateFieldValue("json", [])).toBe(true)
      expect(validateFieldValue("json", { nested: { deep: true } })).toBe(true)
    })

    it("should reject primitives", () => {
      expect(validateFieldValue("json", "string")).toBe(false)
      expect(validateFieldValue("json", 123)).toBe(false)
      expect(validateFieldValue("json", true)).toBe(false)
    })

    it("should accept null as valid (null/undefined shortcut)", () => {
      expect(validateFieldValue("json", null)).toBe(true)
      expect(validateFieldValue("json", undefined)).toBe(true)
    })
  })

  describe("collection", () => {
    it("should accept any value", () => {
      expect(validateFieldValue("collection", "anything")).toBe(true)
      expect(validateFieldValue("collection", 123)).toBe(true)
      expect(validateFieldValue("collection", true)).toBe(true)
      expect(validateFieldValue("collection", {})).toBe(true)
      expect(validateFieldValue("collection", [])).toBe(true)
    })
  })
})

describe("fieldSchema", () => {
  it("should validate a valid field", () => {
    const result = fieldSchema.safeParse({
      id: "1",
      collection_id: "col1",
      name: "email",
      type: "string",
    })
    expect(result.success).toBe(true)
  })

  it("should validate with optional properties", () => {
    const result = fieldSchema.safeParse({
      id: "1",
      collection_id: "col1",
      name: "email",
      type: "string",
      options: { maxLength: 255 },
      required: true,
      default: "test@example.com",
      meta: { hint: "User email" },
    })
    expect(result.success).toBe(true)
  })

  it("should reject invalid type", () => {
    const result = fieldSchema.safeParse({
      id: "1",
      collection_id: "col1",
      name: "email",
      type: "invalid_type",
    })
    expect(result.success).toBe(false)
  })

  it("should reject missing required fields", () => {
    const result = fieldSchema.safeParse({
      id: "1",
      name: "email",
    })
    expect(result.success).toBe(false)
  })

  it("should reject non-string name", () => {
    const result = fieldSchema.safeParse({
      id: "1",
      collection_id: "col1",
      name: 123,
      type: "string",
    })
    expect(result.success).toBe(false)
  })

  it("should validate all field types", () => {
    for (const type of fieldTypes) {
      const result = fieldSchema.safeParse({
        id: "1",
        collection_id: "col1",
        name: "field",
        type,
      })
      expect(result.success).toBe(true)
    }
  })
})
