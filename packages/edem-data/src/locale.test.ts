import { describe, it, expect } from "bun:test"
import { isLocalizedValue, resolveLocalizedValue, resolveLocalizedData } from "./locale"

describe("isLocalizedValue", () => {
  it("should return true for valid localized object", () => {
    expect(isLocalizedValue({ en: "Hello", ru: "Привет" })).toBe(true)
  })

  it("should return true for single locale", () => {
    expect(isLocalizedValue({ en: "Hello" })).toBe(true)
  })

  it("should return false for empty object", () => {
    expect(isLocalizedValue({})).toBe(false)
  })

  it("should return false for null", () => {
    expect(isLocalizedValue(null)).toBe(false)
  })

  it("should return false for array", () => {
    expect(isLocalizedValue(["en", "ru"])).toBe(false)
  })

  it("should return false for string", () => {
    expect(isLocalizedValue("hello")).toBe(false)
  })

  it("should return false for object with non-string values", () => {
    expect(isLocalizedValue({ en: "Hello", ru: 123 })).toBe(false)
  })

  it("should return false for object with mixed string/non-string", () => {
    expect(isLocalizedValue({ en: "Hello", count: 5 })).toBe(false)
  })
})

describe("resolveLocalizedValue", () => {
  it("should resolve exact locale", () => {
    expect(resolveLocalizedValue({ en: "Hello", ru: "Привет" }, "ru")).toBe("Привет")
  })

  it("should fallback to default locale", () => {
    expect(resolveLocalizedValue({ en: "Hello", de: "Hallo" }, "ru")).toBe("Hello")
  })

  it("should fallback to first available locale", () => {
    expect(resolveLocalizedValue({ de: "Hallo", fr: "Bonjour" }, "ru")).toBe("Hallo")
  })

  it("should use custom fallback", () => {
    expect(resolveLocalizedValue({ de: "Hallo", fr: "Bonjour" }, "ru", "fr")).toBe("Bonjour")
  })

  it("should return empty object as-is (not a localized value)", () => {
    expect(resolveLocalizedValue({}, "en")).toEqual({})
  })

  it("should return non-localized value as-is", () => {
    expect(resolveLocalizedValue("hello", "ru")).toBe("hello")
  })

  it("should return number as-is", () => {
    expect(resolveLocalizedValue(42, "ru")).toBe(42)
  })

  it("should return null as-is", () => {
    expect(resolveLocalizedValue(null, "ru")).toBe(null)
  })
})

describe("resolveLocalizedData", () => {
  it("should resolve localized string fields", () => {
    const data = {
      title: { en: "Buy milk", ru: "Купить молоко" },
      status: "active",
    }
    const fieldTypes = new Map([
      ["title", "string" as const],
      ["status", "string" as const],
    ])

    const result = resolveLocalizedData(data, fieldTypes, "ru")
    expect(result.title).toBe("Купить молоко")
    expect(result.status).toBe("active")
  })

  it("should resolve localized text fields", () => {
    const data = {
      body: { en: "Hello", de: "Hallo" },
    }
    const fieldTypes = new Map([["body", "text" as const]])

    const result = resolveLocalizedData(data, fieldTypes, "de")
    expect(result.body).toBe("Hallo")
  })

  it("should not resolve non-localizable types", () => {
    const data = {
      count: { en: "5" },
      flag: { en: "true" },
    }
    const fieldTypes = new Map([
      ["count", "number" as const],
      ["flag", "boolean" as const],
    ])

    const result = resolveLocalizedData(data, fieldTypes, "en")
    expect(result.count).toEqual({ en: "5" })
    expect(result.flag).toEqual({ en: "true" })
  })

  it("should fallback when locale missing", () => {
    const data = {
      title: { en: "Hello", de: "Hallo" },
    }
    const fieldTypes = new Map([["title", "string" as const]])

    const result = resolveLocalizedData(data, fieldTypes, "fr")
    expect(result.title).toBe("Hello")
  })

  it("should handle missing field type gracefully", () => {
    const data = {
      unknown: { en: "value" },
    }
    const fieldTypes = new Map<string, never>()

    const result = resolveLocalizedData(data, fieldTypes, "en")
    expect(result.unknown).toEqual({ en: "value" })
  })
})
