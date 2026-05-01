import { describe, it, expect } from "bun:test"
import { validateFieldValue, fieldTypes } from "./fields"

describe("field types", () => {
  it("should have all field types defined", () => {
    expect(fieldTypes).toContain("string")
    expect(fieldTypes).toContain("number")
    expect(fieldTypes).toContain("boolean")
    expect(fieldTypes).toContain("date")
    expect(fieldTypes).toContain("datetime")
    expect(fieldTypes).toContain("json")
    expect(fieldTypes).toContain("file")
    expect(fieldTypes).toContain("image")
    expect(fieldTypes).toContain("relation")
    expect(fieldTypes).toContain("uuid")
    expect(fieldTypes).toContain("timestamp")
  })
})

describe("validateFieldValue", () => {
  it("should validate string fields", () => {
    expect(validateFieldValue("string", "hello")).toBe(true)
    expect(validateFieldValue("string", 123)).toBe(false)
    expect(validateFieldValue("string", null)).toBe(true)
  })

  it("should validate number fields", () => {
    expect(validateFieldValue("number", 42)).toBe(true)
    expect(validateFieldValue("number", "42")).toBe(false)
    expect(validateFieldValue("number", null)).toBe(true)
  })

  it("should validate boolean fields", () => {
    expect(validateFieldValue("boolean", true)).toBe(true)
    expect(validateFieldValue("boolean", false)).toBe(true)
    expect(validateFieldValue("boolean", 0)).toBe(false)
  })

  it("should validate date fields", () => {
    expect(validateFieldValue("date", "2024-01-15")).toBe(true)
    expect(validateFieldValue("date", "2024-1-15")).toBe(false)
    expect(validateFieldValue("date", "not-a-date")).toBe(false)
  })

  it("should validate datetime fields", () => {
    expect(validateFieldValue("datetime", "2024-01-15T10:30:00")).toBe(true)
    expect(validateFieldValue("datetime", "2024-01-15")).toBe(false)
  })

  it("should validate uuid fields", () => {
    expect(validateFieldValue("uuid", "550e8400-e29b-41d4-a716-446655440000")).toBe(true)
    expect(validateFieldValue("uuid", "not-a-uuid")).toBe(false)
  })

  it("should validate json fields", () => {
    expect(validateFieldValue("json", { key: "value" })).toBe(true)
    expect(validateFieldValue("json", [1, 2, 3])).toBe(true)
    expect(validateFieldValue("json", "string")).toBe(false)
  })
})
