import { describe, it, expect } from "bun:test"
import {
  buildParamMap,
  resolveInObject,
  resolveInTemplate,
  resolveExpr,
  resolveInString,
  resolveVueExpression,
  isTranslation,
  renderT,
} from "./expressions"
import type { ExpressionContext } from "./expressions"
import type { IR } from "./ir"

function makeIR(
  routes: Array<{ path: string; componentName?: string; params: string[] }> = [],
): IR {
  return {
    project: { name: "test", identifier: "test.local" },
    components: [],
    routes: routes.map((r) => ({ ...r, name: "", children: undefined })),
    collections: [],
    flows: [],
    assets: [],
    layout: { hasAppLayout: false, hasSidebar: false, hasTopMenu: false, navigation: [] },
    platform: { platform: "electrobun", features: { waylandWorkaround: false } },
    usedComponents: [],
  }
}

function ctx(params: string[] = ["id"], ir?: IR): ExpressionContext {
  const paramPath = params.map((p) => `:${p}`).join("/")
  return {
    routeParams: params,
    componentName: "TestPage",
    ir: ir ?? makeIR([{ path: `/test/${paramPath}`, componentName: "TestPage", params }]),
  }
}

describe("buildParamMap", () => {
  it("maps context.xxx to route.params.xxx", () => {
    const map = buildParamMap(ctx(["id"]))
    expect(map).toEqual({ "context.id": "route.params.id" })
  })

  it("maps short form (idea → ideaId)", () => {
    const map = buildParamMap(ctx(["ideaId"]))
    expect(map).toEqual({
      "context.ideaId": "route.params.ideaId",
      "context.idea": "route.params.ideaId",
    })
  })

  it("returns empty map when no IR", () => {
    const map = buildParamMap({ routeParams: ["id"], componentName: "Test", ir: undefined })
    expect(map).toEqual({})
  })
})

describe("resolveInObject", () => {
  it("resolves context expressions", () => {
    const result = resolveInObject({ id: "{{ context.id }}" }, ctx())
    expect(result).toBe("{ id: route.params.id }")
  })

  it("resolves event placeholder", () => {
    const result = resolveInObject({ value: "{{ event }}" }, ctx())
    expect(result).toBe("{ value: __EVENT__ }")
  })

  it("resolves item expressions", () => {
    const result = resolveInObject({ title: "{{ item.title }}" }, ctx())
    expect(result).toBe("{ title: item.title }")
  })
})

describe("resolveInTemplate", () => {
  it("resolves context expressions to template literals", () => {
    const result = resolveInTemplate("/project/{{ context.id }}/ideas", ctx())
    expect(result).toBe("/project/${route.params.id}/ideas")
  })

  it("resolves plain variable names via paramMap", () => {
    const result = resolveInTemplate("/project/{{ context.ideaId }}/ideas", ctx(["ideaId"]))
    expect(result).toBe("/project/${route.params.ideaId}/ideas")
  })
})

describe("resolveExpr", () => {
  it("resolves context expressions", () => {
    expect(resolveExpr("{{ context.id }}", ctx())).toBe("route.params.id")
  })

  it("resolves plain variable names via paramMap", () => {
    expect(resolveExpr("{{ context.ideaId }}", ctx(["ideaId"]))).toBe("route.params.ideaId")
  })

  it("returns non-expression as-is", () => {
    expect(resolveExpr("static value", ctx())).toBe("static value")
  })
})

describe("resolveInString", () => {
  it("resolves context expressions in link values", () => {
    const result = resolveInString("/project/{{ context.id }}", ctx())
    expect(result).toBe("/project/${route.params.id}")
  })

  it("returns non-strings as-is", () => {
    expect(resolveInString(42, ctx())).toBe("42")
  })

  it("returns strings without expressions as-is", () => {
    expect(resolveInString("hello", ctx())).toBe("hello")
  })

  it("keeps local computed ids as local variables", () => {
    const result = resolveInString("/project/{{ projectId }}/ideas", ctx())
    expect(result).toBe("/project/${projectId}/ideas")
  })
})

describe("resolveVueExpression", () => {
  it("resolves context expressions keeping {{ }} syntax", () => {
    const result = resolveVueExpression("{{ context.id }}", ctx())
    expect(result).toBe("{{ route.params.id }}")
  })

  it("returns strings without expressions as-is", () => {
    expect(resolveVueExpression("hello", ctx())).toBe("hello")
  })

  it("keeps local id-like variables in vue expressions", () => {
    const result = resolveVueExpression("{{ projectId }}", ctx())
    expect(result).toBe("{{ projectId }}")
  })
})

describe("isTranslation", () => {
  it("returns true for translation objects with $type marker", () => {
    expect(isTranslation({ $type: "translation", en: "Delete", ru: "Удалить" })).toBe(true)
  })

  it("returns true for single language with $type", () => {
    expect(isTranslation({ $type: "translation", en: "Hello" })).toBe(true)
  })

  it("returns false for object without $type", () => {
    expect(isTranslation({ en: "Delete", ru: "Удалить" })).toBe(false)
  })

  it("returns false for ComponentNode", () => {
    expect(isTranslation({ component: "div", children: "text" })).toBe(false)
  })

  it("returns false for strings", () => {
    expect(isTranslation("hello")).toBe(false)
  })

  it("returns false for null", () => {
    expect(isTranslation(null)).toBe(false)
  })

  it("returns false for arrays", () => {
    expect(isTranslation([{ $type: "translation", en: "test" }])).toBe(false)
  })

  it("returns false if $type is not 'translation'", () => {
    expect(isTranslation({ $type: "other", en: "Hello" })).toBe(false)
  })
})

describe("renderT", () => {
  it("renders a translation object as t() call, filtering $type", () => {
    const result = renderT({ $type: "translation", en: "Delete", ru: "Удалить" })
    expect(result).toBe("t({ en: 'Delete', ru: 'Удалить' })")
  })

  it("renders single language", () => {
    const result = renderT({ $type: "translation", en: "Hello" })
    expect(result).toBe("t({ en: 'Hello' })")
  })

  it("escapes quotes in text", () => {
    const result = renderT({
      $type: "translation",
      en: "He said 'hello'",
      ru: "Он сказал 'привет'",
    })
    expect(result).toBe("t({ en: 'He said \\'hello\\'', ru: 'Он сказал \\'привет\\'' })")
  })
})
