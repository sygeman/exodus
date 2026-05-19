// ── Expression Resolver ────────────────────────────────────────────────────────
// Resolves template expressions ({{ expr }}) in different output contexts.
// Centralizes route param mapping — no more hardcoded projectId/ideaId.

import type { Translation } from "@exodus/edem-ui"
import type { IR, IRRoute } from "./ir"

export interface ExpressionContext {
  routeParams: string[]
  componentName: string
  ir?: IR
}

/**
 * Build a map of context keys → route.params expressions.
 * e.g. { "context.id": "route.params.id", "context.idea": "route.params.ideaId" }
 */
export function buildParamMap(ctx: ExpressionContext): Record<string, string> {
  const map: Record<string, string> = {}
  const route = findRouteForComponent(ctx.ir, ctx.componentName)
  if (!route) return map

  for (const param of route.params) {
    map[`context.${param}`] = `route.params.${param}`
    const short = param.replace(/Id$/, "")
    if (short !== param) map[`context.${short}`] = `route.params.${param}`
  }
  return map
}

/**
 * Resolve {{ }} expressions in a Record<string, unknown> → string.
 * Used for handler input/data objects.
 * Output format: `{ key: resolvedValue }`
 */
export function resolveInObject(obj: Record<string, unknown>, ctx: ExpressionContext): string {
  const paramMap = buildParamMap(ctx)

  const entries = Object.entries(obj).map(([key, value]) => {
    const resolved = String(value)
      .replace(
        /\{\{\s*context\.(\w+)\s*\}\}/g,
        (_, ctxKey: string) => paramMap[`context.${ctxKey}`] ?? `route.params.${ctxKey}`,
      )
      .replace(/\{\{\s*event\s*\}\}/g, "__EVENT__")
      .replace(/\{\{\s*item\.(\w+)\s*\}\}/g, (_, field: string) => `item.${field}`)
      .replace(/\{\{\s*item\s*\}\}/g, "item")
      .replace(/\{\{\s*(\w+)\s*\}\}/g, (_, varName: string) => {
        return paramMap[`context.${varName}`] ?? `route.params.${varName}`
      })
    return `${key}: ${resolved}`
  })

  return `{ ${entries.join(", ")} }`
}

/**
 * Resolve {{ }} expressions in a template string → JS template literal.
 * e.g. "/project/{{ context.projectId }}/ideas" → `/project/${route.params.id}/ideas`
 */
export function resolveInTemplate(template: string, ctx: ExpressionContext): string {
  const paramMap = buildParamMap(ctx)
  return template
    .replace(/\{\{\s*context\.(\w+)\s*\}\}/g, (_, key: string) => {
      return `\${${paramMap[`context.${key}`] ?? `route.params.${key}`}}`
    })
    .replace(/\{\{\s*([\s\S]+?)\s*\}\}/g, (_, expression: string) => {
      const trimmed = expression.trim()
      return `\${${paramMap[`context.${trimmed}`] ?? trimmed}}`
    })
}

/**
 * Resolve a single expression string → route.params expression.
 * e.g. "{{ context.projectId }}" → "route.params.id"
 */
export function resolveExpr(expr: string, ctx: ExpressionContext): string {
  const paramMap = buildParamMap(ctx)

  for (const [ctxKey, paramValue] of Object.entries(paramMap)) {
    if (expr.includes(ctxKey)) return paramValue
  }

  if (expr.startsWith("{{ ") && expr.endsWith(" }}")) {
    const varName = expr.slice(3, -3).trim()
    return paramMap[`context.${varName}`] ?? `route.params.${varName}`
  }

  return expr
}

/**
 * Resolve {{ }} expressions in a string value for Vue template attributes.
 * Converts to template literal syntax with ${ }.
 */
export function resolveInString(value: unknown, ctx: ExpressionContext): string {
  if (typeof value !== "string") return String(value ?? "")
  if (!value.includes("{{")) return value

  const paramMap = buildParamMap(ctx)

  let result = value.replace(/\{\{\s*context\.(\w+)\s*\}\}/g, (_, key: string) => {
    return `\${${paramMap[`context.${key}`] ?? `route.params.${key}`}}`
  })

  result = result.replace(/\{\{\s*([\s\S]+?)\s*\}\}/g, (_, expression: string) => {
    const trimmed = expression.trim()
    const paramName = paramMap[`context.${trimmed}`]
    if (paramName) return `\${${paramName}}`
    return `\${${trimmed}}`
  })

  return result
}

/**
 * Resolve {{ }} expressions in Vue template content, keeping {{ }} syntax.
 * Used for text content that should remain as Vue template expressions.
 */
export function resolveVueExpression(value: string, ctx: ExpressionContext): string {
  if (!value.includes("{{")) return value
  const paramMap = buildParamMap(ctx)

  return (
    value
      .replace(/\{\{\s*context\.(\w+)\s*\}\}/g, (_, key: string) => {
        const param = paramMap[`context.${key}`] ?? `route.params.${key}`
        return `{{ ${param} }}`
      })
      // Only resolve simple variable names that match route params (e.g. {{ projectId }})
      // Don't resolve compound expressions like {{ item.id }} or {{ item }}
      .replace(/\{\{\s*(\w+)\s*\}\}/g, (_, varName: string) => {
        const param = paramMap[`context.${varName}`]
        if (param) return `{{ ${param} }}`
        return `{{ ${varName} }}`
      })
  )
}

// ── Internal helpers ──────────────────────────────────────────────────────────

export function findRouteForComponent(ir?: IR, compName?: string): IRRoute | undefined {
  if (!ir || !compName) return undefined
  return findRouteInList(ir.routes, compName)
}

function findRouteInList(routes: IRRoute[], compName: string): IRRoute | undefined {
  for (const route of routes) {
    if (route.componentName === compName) return route
    if (route.children) {
      const found = findRouteInList(route.children, compName)
      if (found) return found
    }
  }
  return undefined
}

// ── i18n Translation Helpers ──────────────────────────────────────────────────

/**
 * Checks if an object is a translation record by looking for the `$type: "translation"` marker.
 */
export function isTranslation(obj: unknown): obj is Translation {
  return (
    typeof obj === "object" &&
    obj !== null &&
    !Array.isArray(obj) &&
    "$type" in obj &&
    (obj as Record<string, unknown>).$type === "translation"
  )
}

/**
 * Renders a translation object as a t() call.
 * Filters out the $type marker. Uses single quotes for values to avoid
 * conflicts with HTML attribute double quotes.
 */
export function renderT(translations: Translation): string {
  const entries = Object.entries(translations)
    .filter(([k]) => k !== "$type")
    .map(([lang, text]) => `${lang}: '${text.replace(/'/g, "\\'")}'`)
    .join(", ")
  return `t({ ${entries} })`
}
