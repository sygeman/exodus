// ── Handler Code Generation ───────────────────────────────────────────────────
// Generates JavaScript handler functions from event bindings.

import type { EventBinding } from "@exodus/edem-ui"
import type { IR } from "../../ir"
import { capitalize, slugify } from "../../utils"
import {
  resolveInObject,
  resolveInTemplate,
  resolveExpr,
  findRouteForComponent,
  type ExpressionContext,
} from "../../expressions"

export function buildExprCtx(ir?: IR, compName?: string): ExpressionContext {
  const route = findRouteForComponent(ir, compName)
  return { routeParams: route?.params ?? [], componentName: compName ?? "", ir }
}

export function collectHandlerCode(
  events: Record<string, EventBinding>,
  handlers: Map<string, string>,
  ir?: IR,
  compName?: string,
): void {
  const ctx = buildExprCtx(ir, compName)
  for (const [, binding] of Object.entries(events)) {
    if ("flow" in binding) {
      const input = binding.input ? resolveInObject(binding.input, ctx) : ""
      const handlerName = `handle${capitalize(binding.flow)}`
      if (input) {
        const hasEvent = input.includes("__EVENT__")
        const hasItem = input.includes("item.")
        const params: string[] = []
        if (hasEvent) params.push("$event")
        if (hasItem) params.push("item")
        const paramStr = params.join(", ")
        const inputEntries = input
          .slice(1, -1)
          .trim()
          .replace(/__EVENT__/g, "$event")
        handlers.set(
          handlerName,
          `function ${handlerName}(${paramStr}) {
  edem.flows.runFlow({ flow_id: "${binding.flow}", trigger_data: { ${inputEntries} } })
}`,
        )
      } else {
        handlers.set(
          handlerName,
          `function ${handlerName}() {
  edem.flows.runFlow({ flow_id: "${binding.flow}" })
}`,
        )
      }
    }

    if ("navigate" in binding) {
      const handlerName = `handleNavigate${slugify(binding.navigate)}`
      if (binding.navigate === "back") {
        handlers.set(
          handlerName,
          `function ${handlerName}() {
  router.back()
}`,
        )
      } else if (binding.navigate === "forward") {
        handlers.set(
          handlerName,
          `function ${handlerName}() {
  router.forward()
}`,
        )
      } else {
        const resolved = resolveInTemplate(binding.navigate, ctx)
        if (resolved.includes("${")) {
          handlers.set(
            handlerName,
            `function ${handlerName}() {
  router.push(\`${resolved}\`)
}`,
          )
        } else {
          handlers.set(
            handlerName,
            `function ${handlerName}() {
  router.push("${resolved}")
}`,
          )
        }
      }
    }

    if ("action" in binding) {
      const { action, collection: col } = binding

      if (action === "updateItem" && col) {
        const updateFn = `update${capitalize(col)}`
        const data = resolveInObject(binding.data ?? {}, ctx)
        handlers.set(
          `handleUpdate${capitalize(col)}`,
          `function handleUpdate${capitalize(col)}(v: unknown) {
  const data = ${data.replace(/__EVENT__/g, "v")}
  ${updateFn}(data.id as string, data)
}`,
        )
      }

      if (action === "deleteItem" && col) {
        const removeFn = `remove${capitalize(col)}`
        const idExpr = binding.data?.id ? resolveExpr(String(binding.data.id), ctx) : "item.id"
        handlers.set(
          `handleDelete${capitalize(col)}`,
          `function handleDelete${capitalize(col)}() {
  ${removeFn}(${idExpr})
}`,
        )
      }
    }
  }
}
