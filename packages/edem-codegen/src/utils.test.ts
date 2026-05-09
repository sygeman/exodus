import { describe, it, expect } from "bun:test"
import { capitalize, kebabCase, camelCase, slugify, escapeAttr } from "./utils"

describe("capitalize", () => {
  it("capitalizes first letter", () => {
    expect(capitalize("hello")).toBe("Hello")
    expect(capitalize("Hello")).toBe("Hello")
    expect(capitalize("")).toBe("")
  })
})

describe("kebabCase", () => {
  it("converts to kebab-case", () => {
    expect(kebabCase("camelCase")).toBe("camel-case")
    expect(kebabCase("PascalCase")).toBe("pascal-case")
    expect(kebabCase("already-kebab")).toBe("already-kebab")
  })
})

describe("camelCase", () => {
  it("converts to camelCase", () => {
    expect(camelCase("kebab-case")).toBe("kebabCase")
    expect(camelCase("single")).toBe("single")
    expect(camelCase("multi-dash-case")).toBe("multiDashCase")
  })
})

describe("slugify", () => {
  it("slugifies strings", () => {
    expect(slugify("/project/{{ id }}/ideas")).toBe("project_id_ideas")
    expect(slugify("hello world")).toBe("hello_world")
  })
})

describe("escapeAttr", () => {
  it("escapes special characters", () => {
    expect(escapeAttr('a"b')).toBe("a&quot;b")
    expect(escapeAttr("a<b")).toBe("a&lt;b")
    expect(escapeAttr("a>b")).toBe("a>b")
  })
})
