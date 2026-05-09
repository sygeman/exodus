import {
  routesManifestSchema,
  componentNodeSchema,
  routeSchema,
  dataBindingSchema,
  eventBindingSchema,
  type RoutesManifest,
  type ComponentNode,
  type Route,
  type DataBinding,
  type EventBinding,
} from "./schemas"

export type { RoutesManifest, ComponentNode, Route, DataBinding, EventBinding }
export {
  routesManifestSchema,
  componentNodeSchema,
  routeSchema,
  dataBindingSchema,
  eventBindingSchema,
}

// ── Template Engine ───────────────────────────────────────────────────────────

export type RenderContext = Record<string, unknown>

export function resolveTemplate(template: string, context: RenderContext): string {
  return template.replace(/\{\{\s*(.+?)\s*\}\}/g, (_, expr: string) => {
    const value = evaluateExpression(expr.trim(), context)
    return value === undefined ? "" : String(value)
  })
}

function evaluateExpression(expr: string, context: RenderContext): unknown {
  const parts = expr.split(".")
  let current: unknown = context

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined
    }
    current = (current as Record<string, unknown>)[part]
  }

  return current
}

// ── Binding Resolver ──────────────────────────────────────────────────────────

export function resolveBindings(node: ComponentNode, context: RenderContext): ComponentNode {
  const resolved: ComponentNode = { component: node.component }

  if (node.props) {
    resolved.props = resolveProps(node.props, context)
  }

  if (typeof node.children === "string") {
    resolved.children = resolveTemplate(node.children, context)
  } else if (Array.isArray(node.children)) {
    resolved.children = node.children.map((child) => resolveBindings(child, context))
  }

  if (node.bind?.item) {
    resolved.bind = {
      ...node.bind,
      item: resolveBindings(node.bind.item, context),
    }
  }

  return resolved
}

function resolveProps(
  props: Record<string, unknown>,
  context: RenderContext,
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(props)) {
    if (typeof value === "string") {
      resolved[key] = resolveTemplate(value, context)
    } else {
      resolved[key] = value
    }
  }

  return resolved
}
