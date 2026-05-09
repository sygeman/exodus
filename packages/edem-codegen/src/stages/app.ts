import type { Stage, StageInput, StageOutput, OutputFile, IR, IRComponent } from "../ir"
import type { ComponentNode, EventBinding } from "@exodus/edem-ui"

// ── App Stage ─────────────────────────────────────────────────────────────────

export const appStage: Stage = {
  name: "app",

  async handle({ ir }: StageInput): Promise<StageOutput> {
    const files: OutputFile[] = []

    for (const comp of ir.components) {
      files.push({
        path: `src/components/${comp.name}.vue`,
        content: generateVueComponent(comp, ir),
      })
    }

    files.push({
      path: ".gitignore",
      content: `node_modules\ndist\n.DS_Store\n*.local\n`,
    })

    return { files, deps: [] }
  },
}

// ── Vue Component ─────────────────────────────────────────────────────────────

function generateVueComponent(comp: IRComponent, ir: IR): string {
  const { template, handlers } = renderNode(comp.tree, "  ", ir, comp.name)
  const script = renderScript(comp, ir, handlers)

  return `<script setup lang="ts">
${script}
</script>

<template>
${template}
</template>
`
}

interface RenderResult {
  template: string
  handlers: Map<string, string>
}

function renderNode(node: ComponentNode, indent: string, ir: IR, compName?: string): RenderResult {
  const tag = node.component
  const props = node.props ? renderProps(node.props) : ""
  const events = renderEvents(node.events)

  const handlers = new Map<string, string>()
  if (node.events) {
    collectHandlerCode(node.events, handlers, ir, compName)
  }

  // bind.item = list iteration → render item template as child with v-for
  if (node.bind?.item) {
    const itemResult = renderNode(node.bind.item, indent + "  ", ir, compName)
    for (const [k, v] of itemResult.handlers) handlers.set(k, v)

    let vfor = ""
    if (node.bind.collection) {
      vfor = ` v-for="item in ${node.bind.collection}" :key="item.id"`
    } else if (node.bind.items) {
      const items = node.bind.items
      if (typeof items === "string" && items.includes("{{")) {
        const expr = items.replace(/\{\{\s*(.+?)\s*\}\}/g, "$1")
        vfor = ` v-for="(item, idx) in ${expr}" :key="idx"`
      } else if (Array.isArray(items)) {
        const quoted = items.map((v) => (typeof v === "string" ? `'${v}'` : JSON.stringify(v)))
        vfor = ` v-for="(item, idx) in [${quoted.join(", ")}]" :key="idx"`
      } else {
        vfor = ` v-for="(item, idx) in ${JSON.stringify(items)}" :key="idx"`
      }
    }

    return {
      template: `${indent}<${tag}${props}${vfor}${events}>\n${itemResult.template}\n${indent}</${tag}>`,
      handlers,
    }
  }

  // String children
  if (typeof node.children === "string") {
    return {
      template: `${indent}<${tag}${props}${events}>${node.children}</${tag}>`,
      handlers,
    }
  }

  // Array children
  if (Array.isArray(node.children) && node.children.length > 0) {
    const childResults = node.children.map((child) =>
      renderNode(child, indent + "  ", ir, compName),
    )
    for (const r of childResults) {
      for (const [k, v] of r.handlers) handlers.set(k, v)
    }
    const children = childResults.map((r) => r.template).join("\n")
    return {
      template: `${indent}<${tag}${props}${events}>\n${children}\n${indent}</${tag}>`,
      handlers,
    }
  }

  // Self-closing
  return {
    template: `${indent}<${tag}${props}${events} />`,
    handlers,
  }
}

function renderProps(props: Record<string, unknown>): string {
  const entries = Object.entries(props)
  if (entries.length === 0) return ""

  return entries
    .map(([key, value]) => {
      const attr = kebabCase(key)

      if (key === "modelValue" || key === "model-value") {
        if (typeof value === "string" && value.startsWith("{{ ")) {
          return ` :model-value="${extractExpr(value)}"`
        }
        return ` :model-value="${JSON.stringify(value)}"`
      }

      if (typeof value === "string") {
        if (value.includes("{{ ")) {
          // Multi-expression or single → :attr="expr"
          const resolved = value.replace(/\{\{\s*(.+?)\s*\}\}/g, (_, e: string) => `\${${e}}`)
          if (
            resolved.startsWith("${") &&
            resolved.endsWith("}") &&
            !resolved.slice(2, -1).includes("${")
          ) {
            return ` :${attr}="${resolved.slice(2, -1)}"`
          }
          // style="background-color: {{ item.color }}" → :style="{ backgroundColor: item.color }"
          if (key === "style") {
            // "background-color: {{ item.color }}" → :style="{ backgroundColor: item.color }"
            const propMatch = value.match(/^([\w-]+):\s*\{\{\s*(.+?)\s*\}\}$/)
            if (propMatch) {
              const cssProp = propMatch[1]
              const expr = propMatch[2]
              const camelProp = cssProp.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
              return ` :style="{ ${camelProp}: ${expr} }"`
            }
          }
          return ` :${attr}="${resolved}"`
        }
        return ` ${attr}="${escapeAttr(value)}"`
      }
      if (typeof value === "boolean") {
        return value ? ` ${attr}` : ""
      }
      if (value === null || value === undefined) {
        return ""
      }
      if (Array.isArray(value)) {
        const items = value.map((v) => (typeof v === "string" ? `'${v}'` : JSON.stringify(v)))
        return ` :${attr}="[${items.join(", ")}]"`
      }
      return ` :${attr}="${JSON.stringify(value)}"`
    })
    .join("")
}

function renderEvents(events: Record<string, EventBinding> | undefined): string {
  if (!events) return ""

  const parts: string[] = []
  for (const [eventName, binding] of Object.entries(events)) {
    if ("flow" in binding) {
      const hasEvent = binding.input && JSON.stringify(binding.input).includes("{{ event }}")
      const hasItem = binding.input && JSON.stringify(binding.input).includes("{{ item")
      const args: string[] = []
      if (hasEvent) args.push("$event")
      if (hasItem) args.push("item")
      const argStr = args.length > 0 ? `(${args.join(", ")})` : "()"
      parts.push(` @${kebabCase(eventName)}="handle${capitalize(binding.flow)}${argStr}"`)
    }
    if ("navigate" in binding) {
      parts.push(` @${kebabCase(eventName)}="handleNavigate${slugify(binding.navigate)}()"`)
    }
    if ("action" in binding) {
      if (eventName === "update:modelValue") {
        const col = binding.collection ?? "item"
        parts.push(` @update:model-value="handleUpdate${capitalize(col)}($event)"`)
      } else if (binding.action === "deleteItem" && binding.collection) {
        parts.push(` @${kebabCase(eventName)}="handleDelete${capitalize(binding.collection)}()"`)
      }
    }
  }

  return parts.join("")
}

// ── Handler Code Generation ───────────────────────────────────────────────────

function collectHandlerCode(
  events: Record<string, EventBinding>,
  handlers: Map<string, string>,
  ir?: IR,
  compName?: string,
): void {
  for (const [, binding] of Object.entries(events)) {
    if ("flow" in binding) {
      const input = binding.input ? resolveContextParams(binding.input, ir, compName) : ""
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
  edem.flows.trigger({ flow_id: "${binding.flow}", ${inputEntries} })
}`,
        )
      } else {
        handlers.set(
          handlerName,
          `function ${handlerName}() {
  edem.flows.trigger({ flow_id: "${binding.flow}" })
}`,
        )
      }
    }

    if ("navigate" in binding) {
      const handlerName = `handleNavigate${slugify(binding.navigate)}`
      const resolved = resolveTemplateString(binding.navigate, ir, compName)
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

    if ("action" in binding) {
      const { action, collection: col } = binding

      if (action === "updateItem" && col) {
        const updateFn = `update${capitalize(col)}`
        const data = resolveContextParams(binding.data ?? {}, ir, compName)
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
        const idExpr = binding.data?.id
          ? resolveTemplateExpr(String(binding.data.id), ir, compName)
          : "item.id"
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

function resolveContextParams(obj: Record<string, unknown>, ir?: IR, compName?: string): string {
  const paramMap = buildContextParamMap(ir, compName)

  const entries = Object.entries(obj).map(([key, value]) => {
    const resolved = String(value)
      .replace(
        /\{\{\s*context\.(\w+)\s*\}\}/g,
        (_, ctxKey: string) => paramMap[`context.${ctxKey}`] ?? `route.params.${ctxKey}`,
      )
      .replace(/\{\{\s*event\s*\}\}/g, "__EVENT__")
      .replace(/\{\{\s*item\.(\w+)\s*\}\}/g, (_, field: string) => `item.${field}`)
      .replace(/\{\{\s*item\s*\}\}/g, "item")
    return `${key}: ${resolved}`
  })

  return `{ ${entries.join(", ")} }`
}

function resolveTemplateString(template: string, ir?: IR, compName?: string): string {
  const paramMap = buildContextParamMap(ir, compName)
  return template.replace(/\{\{\s*context\.(\w+)\s*\}\}/g, (_, key: string) => {
    return `\${${paramMap[`context.${key}`] ?? `route.params.${key}`}}`
  })
}

function resolveTemplateExpr(expr: string, ir?: IR, compName?: string): string {
  const paramMap = buildContextParamMap(ir, compName)
  for (const [ctxKey, paramValue] of Object.entries(paramMap)) {
    if (expr.includes(ctxKey)) return paramValue
  }
  return expr
}

function buildContextParamMap(ir?: IR, compName?: string): Record<string, string> {
  const map: Record<string, string> = {}
  const route = ir?.routes.find((r) => r.componentName === compName)
  if (!route) return map

  for (const param of route.params) {
    map[`context.${param}`] = `route.params.${param}`
    const short = param.replace(/Id$/, "")
    if (short !== param) map[`context.${short}`] = `route.params.${param}`
  }
  return map
}

// ── Script ────────────────────────────────────────────────────────────────────

function renderScript(comp: IRComponent, ir: IR, handlers: Map<string, string>): string {
  const imports: string[] = []
  const statements: string[] = []
  const routerImports = new Set<string>()

  const route = ir.routes.find((r) => r.componentName === comp.name)
  if (route && route.params.length > 0) {
    routerImports.add("useRoute")
    statements.push(`const route = useRoute()`)
  }

  for (const colId of comp.usedCollections) {
    const fnName = `use${capitalize(colId)}`
    const col = ir.collections.find((c) => c.id === colId)
    if (!col) continue

    const varName = camelCase(colId)
    if (col.singleton) {
      statements.push(
        `const { item: ${varName}, update: update${capitalize(colId)} } = ${fnName}()`,
      )
    } else {
      const filterParam = buildFilterParam(colId, comp, ir)
      statements.push(
        `const { items: ${varName}, update: update${capitalize(colId)}, remove: remove${capitalize(colId)} } = ${fnName}(${filterParam})`,
      )
    }
  }

  for (const colId of comp.usedCollections) {
    imports.push(`import { use${capitalize(colId)} } from "@/composables/use${capitalize(colId)}"`)
  }

  if (comp.needsEdem) {
    imports.push(`import { useEdem } from "@/edem"`)
    statements.push(`const edem = useEdem()`)
  }

  const needsRouter =
    comp.needsRouter || [...handlers.values()].some((h) => h.includes("router.push"))
  if (needsRouter) {
    routerImports.add("useRouter")
    statements.push(`const router = useRouter()`)
  }

  if (routerImports.size > 0) {
    imports.unshift(`import { ${[...routerImports].join(", ")} } from "vue-router"`)
  }

  for (const code of handlers.values()) {
    statements.push("")
    statements.push(code)
  }

  if (imports.length === 0 && statements.length === 0) return ""

  const importBlock = imports.length > 0 ? imports.join("\n") + "\n\n" : ""
  return `${importBlock}${statements.join("\n")}`
}

function buildFilterParam(colId: string, comp: IRComponent, ir: IR): string {
  const route = ir.routes.find((r) => r.componentName === comp.name)
  if (!route || route.params.length === 0) return ""

  const col = ir.collections.find((c) => c.id === colId)
  if (!col) return ""

  const filters: string[] = []
  for (const param of route.params) {
    // Match by field name (e.g. project_id matches param "id" → project_id)
    for (const field of col.fields) {
      if (field.name === `${param.replace(/Id$/, "")}_id` || field.name === param) {
        filters.push(`${field.name}: { _eq: route.params.${param} }`)
      }
    }
    // Match by primary key (e.g. "id" param or "ideaId" param for "ideas" collection)
    const isPrimaryKey =
      param === "id" || param.toLowerCase() === `${colId}id` || param === `${colId}Id`
    if (isPrimaryKey && !filters.some((f) => f.startsWith("id:"))) {
      filters.push(`id: { _eq: route.params.${param} }`)
    }
  }

  if (filters.length === 0) return ""
  return `{ filter: { ${filters.join(", ")} } }`
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractExpr(template: string): string {
  const match = template.match(/\{\{\s*(.+?)\s*\}\}/)
  return match ? match[1] : ""
}

function kebabCase(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function camelCase(str: string): string {
  return str.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
}

function slugify(str: string): string {
  return str
    .replace(/\//g, "-")
    .replace(/\{\{\s*(.+?)\s*\}\}/g, "$1")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
}

function escapeAttr(str: string): string {
  return str.replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}
