import type {
  Stage,
  StageInput,
  StageOutput,
  OutputFile,
  IR,
  IRComponent,
  ExtendedComponentNode,
} from "../ir"
import type { EventBinding } from "@exodus/edem-ui"

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

function renderNode(
  node: ExtendedComponentNode,
  indent: string,
  ir: IR,
  compName?: string,
): RenderResult {
  const handlers = new Map<string, string>()

  // Collect handlers from events
  if (node.events) {
    collectHandlerCode(node.events, handlers, ir, compName)
  }

  // ── Conditional rendering ────────────────────────────────────────────────
  let ifAttr = ""
  if (node.if) {
    ifAttr = ` v-if="${extractExpr(node.if)}"`
  } else if (node.elseIf) {
    ifAttr = ` v-else-if="${extractExpr(node.elseIf)}"`
  } else if (node.else) {
    ifAttr = " v-else"
  }

  // ── Skeleton state ───────────────────────────────────────────────────────
  if (node.skeleton) {
    return {
      template: `${indent}<div${ifAttr} class="flex flex-1 flex-col gap-4">\n${indent}  <div class="mb-4 flex items-center justify-between">\n${indent}    <USkeleton class="h-8 w-40" />\n${indent}    <USkeleton class="h-9 w-32" />\n${indent}  </div>\n${indent}  <div v-for="i in 5" :key="i" class="flex items-center gap-4 rounded-lg border border-[var(--ui-border)] p-4">\n${indent}    <USkeleton class="h-10 w-10 flex-shrink-0 rounded-lg" />\n${indent}    <USkeleton class="h-5 w-48" />\n${indent}  </div>\n${indent}</div>`,
      handlers,
    }
  }

  // ── Empty state ──────────────────────────────────────────────────────────
  if (node.empty) {
    const emptyIcon = node.empty.icon ?? "i-lucide-inbox"
    const emptyText = node.empty.text ?? "Nothing here yet"
    const emptyAction = node.empty.action
      ? `\n${indent}  ${renderNode(node.empty.action, indent + "  ", ir, compName).template}`
      : ""
    return {
      template: `${indent}<div${ifAttr} class="flex flex-1 flex-col items-center justify-center gap-4">\n${indent}  <UIcon name="${emptyIcon}" class="h-12 w-12 text-[var(--ui-text-muted)]" />\n${indent}  <p class="text-lg text-[var(--ui-text-muted)]">${emptyText}</p>${emptyAction}\n${indent}</div>`,
      handlers,
    }
  }

  const tag = node.component
  const props = node.props ? renderProps(node.props) : ""
  const events = renderEvents(node.events)

  // ── Link (RouterLink) ────────────────────────────────────────────────────
  if (typeof node.link === "string") {
    const to = resolveExprInString(node.link, ir, compName)
    const tagProps = props ? ` :to="${to}"${props}` : ` :to="${to}"`
    if (typeof node.children === "string") {
      return {
        template: `${indent}<RouterLink${tagProps}${ifAttr}${events}>${node.children}</RouterLink>`,
        handlers,
      }
    }
    if (Array.isArray(node.children) && node.children.length > 0) {
      const childResults = node.children.map((child) =>
        renderNode(child, indent + "  ", ir, compName),
      )
      for (const r of childResults) {
        for (const [k, v] of r.handlers) handlers.set(k, v)
      }
      const children = childResults.map((r) => r.template).join("\n")
      return {
        template: `${indent}<RouterLink${tagProps}${ifAttr}${events}>\n${children}\n${indent}</RouterLink>`,
        handlers,
      }
    }
    return {
      template: `${indent}<RouterLink${tagProps}${ifAttr}${events} />`,
      handlers,
    }
  }

  // ── Modal wrapping ───────────────────────────────────────────────────────
  if (node.modal) {
    const vModel = node.modal.vModel
    const footerResult = node.modal.footer
      ? node.modal.footer.map((f) => renderNode(f, indent + "    ", ir, compName))
      : []
    for (const r of footerResult) {
      for (const [k, v] of r.handlers) handlers.set(k, v)
    }
    const footerHtml = footerResult.map((r) => r.template).join("\n")
    const title = node.modal.title ? ` title="${escapeAttr(node.modal.title)}"` : ""
    const desc = node.modal.description
      ? ` description="${escapeAttr(node.modal.description)}"`
      : ""
    return {
      template: `${indent}<UModal v-model:open="${vModel}"${title}${desc}>\n${indent}  <template #footer>\n${indent}    <div class="flex w-full justify-end gap-3">\n${footerHtml}\n${indent}    </div>\n${indent}  </template>\n${indent}</UModal>`,
      handlers,
    }
  }

  // ── Teleport ─────────────────────────────────────────────────────────────
  if (node.teleport) {
    const inner = renderNode(
      { ...node, teleport: undefined, component: "div" },
      indent + "  ",
      ir,
      compName,
    )
    for (const [k, v] of inner.handlers) handlers.set(k, v)
    return {
      template: `${indent}<Teleport to="${node.teleport}">\n${inner.template}\n${indent}</Teleport>`,
      handlers,
    }
  }

  // ── Transition wrapping ──────────────────────────────────────────────────
  if (node.transition) {
    const t = node.transition
    const attrs = [
      t.enterActiveClass ? ` enter-active-class="${escapeAttr(t.enterActiveClass)}"` : "",
      t.enterFromClass ? ` enter-from-class="${escapeAttr(t.enterFromClass)}"` : "",
      t.enterToClass ? ` enter-to-class="${escapeAttr(t.enterToClass)}"` : "",
      t.leaveActiveClass ? ` leave-active-class="${escapeAttr(t.leaveActiveClass)}"` : "",
      t.leaveFromClass ? ` leave-from-class="${escapeAttr(t.leaveFromClass)}"` : "",
      t.leaveToClass ? ` leave-to-class="${escapeAttr(t.leaveToClass)}"` : "",
    ].join("")
    const inner = renderNode({ ...node, transition: undefined }, indent + "  ", ir, compName)
    for (const [k, v] of inner.handlers) handlers.set(k, v)
    return {
      template: `${indent}<Transition${attrs}>\n${inner.template}\n${indent}</Transition>`,
      handlers,
    }
  }

  // ── Named slots ──────────────────────────────────────────────────────────
  if (node.namedSlots && tag !== "RouterView") {
    // Render as component with named slots
    const slotEntries = Object.entries(node.namedSlots)
    const slotParts = slotEntries.map(([name, slotNodes]) => {
      const slotContent = slotNodes.map((n) => renderNode(n, indent + "    ", ir, compName))
      for (const r of slotContent) {
        for (const [k, v] of r.handlers) handlers.set(k, v)
      }
      return `${indent}  <template #${name}>\n${slotContent.map((r) => r.template).join("\n")}\n${indent}  </template>`
    })
    return {
      template: `${indent}<${tag}${props}${ifAttr}${events}>\n${slotParts.join("\n")}\n${indent}</${tag}>`,
      handlers,
    }
  }

  // ── bind.item = list iteration ───────────────────────────────────────────
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
        const hasObjects = items.some((v) => typeof v === "object" && v !== null)
        if (hasObjects) {
          const varName = `items_${compName ?? "static"}_${Math.random().toString(36).slice(2, 8)}`
          handlers.set(`const_${varName}`, `const ${varName} = ${JSON.stringify(items)} as const`)
          vfor = ` v-for="(item, idx) in ${varName}" :key="idx"`
        } else {
          const quoted = items.map((v) => (typeof v === "string" ? `'${v}'` : JSON.stringify(v)))
          vfor = ` v-for="(item, idx) in [${quoted.join(", ")}]" :key="idx"`
        }
      } else {
        vfor = ` v-for="(item, idx) in ${JSON.stringify(items)}" :key="idx"`
      }
    }

    return {
      template: `${indent}<${tag}${props}${vfor}${ifAttr}${events}>\n${itemResult.template}\n${indent}</${tag}>`,
      handlers,
    }
  }

  // ── String children ──────────────────────────────────────────────────────
  if (typeof node.children === "string") {
    const content = resolveVueTemplateString(node.children, ir, compName)
    return {
      template: `${indent}<${tag}${props}${ifAttr}${events}>${content}</${tag}>`,
      handlers,
    }
  }

  // ── Array children ───────────────────────────────────────────────────────
  if (Array.isArray(node.children) && node.children.length > 0) {
    const childResults = node.children.map((child) => {
      // Handle string children in arrays
      if (typeof child === "string") {
        const resolved = resolveVueTemplateString(child, ir, compName)
        return { template: `${indent}  ${resolved}`, handlers: new Map<string, string>() }
      }
      return renderNode(child, indent + "  ", ir, compName)
    })
    for (const r of childResults) {
      for (const [k, v] of r.handlers) handlers.set(k, v)
    }
    const children = childResults.map((r) => r.template).join("\n")
    return {
      template: `${indent}<${tag}${props}${ifAttr}${events}>\n${children}\n${indent}</${tag}>`,
      handlers,
    }
  }

  // ── Self-closing ─────────────────────────────────────────────────────────
  return {
    template: `${indent}<${tag}${props}${ifAttr}${events} />`,
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
      // Resolve plain variable names like {{ projectId }} → route.params.id
      .replace(/\{\{\s*(\w+)\s*\}\}/g, (_, varName: string) => {
        if (varName === "projectId") return "route.params.id"
        if (varName === "ideaId") return "route.params.ideaId"
        return paramMap[`context.${varName}`] ?? `route.params.${varName}`
      })
    return `${key}: ${resolved}`
  })

  return `{ ${entries.join(", ")} }`
}

function resolveTemplateString(template: string, ir?: IR, compName?: string): string {
  const paramMap = buildContextParamMap(ir, compName)
  return template
    .replace(/\{\{\s*context\.(\w+)\s*\}\}/g, (_, key: string) => {
      return `\${${paramMap[`context.${key}`] ?? `route.params.${key}`}}`
    })
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (_, varName: string) => {
      if (varName === "projectId") return `\${route.params.id}`
      if (varName === "ideaId") return `\${route.params.ideaId}`
      return `\${route.params.${varName}}`
    })
}

function resolveTemplateExpr(expr: string, ir?: IR, compName?: string): string {
  const paramMap = buildContextParamMap(ir, compName)
  for (const [ctxKey, paramValue] of Object.entries(paramMap)) {
    if (expr.includes(ctxKey)) return paramValue
  }
  // Handle plain variable names
  if (expr === "{{ projectId }}") return "route.params.id"
  if (expr === "{{ ideaId }}") return "route.params.ideaId"
  if (expr.startsWith("{{ ") && expr.endsWith(" }}")) {
    const varName = expr.slice(3, -3).trim()
    if (varName === "projectId") return "route.params.id"
    if (varName === "ideaId") return "route.params.ideaId"
    return `route.params.${varName}`
  }
  return expr
}

function buildContextParamMap(ir?: IR, compName?: string): Record<string, string> {
  const map: Record<string, string> = {}
  const route = findRouteForComponent(ir, compName)
  if (!route) return map

  for (const param of route.params) {
    map[`context.${param}`] = `route.params.${param}`
    const short = param.replace(/Id$/, "")
    if (short !== param) map[`context.${short}`] = `route.params.${param}`
  }
  return map
}

function findRouteForComponent(ir?: IR, compName?: string): import("../ir").IRRoute | undefined {
  if (!ir || !compName) return undefined
  return findRouteInList(ir.routes, compName)
}

function findRouteInList(
  routes: import("../ir").IRRoute[],
  compName: string,
): import("../ir").IRRoute | undefined {
  for (const route of routes) {
    if (route.componentName === compName) return route
    if (route.children) {
      const found = findRouteInList(route.children, compName)
      if (found) return found
    }
  }
  return undefined
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function collectFunctionCalls(node: ExtendedComponentNode): Set<string> {
  const calls = new Set<string>()

  if (node.props) {
    for (const value of Object.values(node.props)) {
      if (typeof value === "string") {
        const matches = value.matchAll(/\{\{\s*(\w+)\s*\(/g)
        for (const m of matches) calls.add(m[1])
      }
    }
  }

  if (typeof node.children === "string") {
    const matches = node.children.matchAll(/\{\{\s*(\w+)\s*\(/g)
    for (const m of matches) calls.add(m[1])
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      for (const call of collectFunctionCalls(child)) {
        calls.add(call)
      }
    }
  }

  if (node.bind?.item) {
    for (const call of collectFunctionCalls(node.bind.item)) {
      calls.add(call)
    }
  }

  if (node.modal?.footer) {
    for (const child of node.modal.footer) {
      for (const call of collectFunctionCalls(child)) calls.add(call)
    }
  }

  if (node.namedSlots) {
    for (const slotNodes of Object.values(node.namedSlots)) {
      for (const child of slotNodes) {
        for (const call of collectFunctionCalls(child)) calls.add(call)
      }
    }
  }

  if (node.empty?.action) {
    for (const call of collectFunctionCalls(node.empty.action)) calls.add(call)
  }

  return calls
}

function generateHelperFunction(name: string): string {
  switch (name) {
    case "getLevelColor":
      return `function getLevelColor(level: string): string {
  const colors: Record<string, string> = { L0: "#22c55e", L1: "#06b6d4", L2: "#eab308", L3: "#f97316", L4: "#ef4444" }
  return colors[level] ?? "#6b7280"
}`
    case "getIdeaTypeColor":
      return `function getIdeaTypeColor(type: string): string {
  const colors: Record<string, string> = { goal: "#22c55e", non_goal: "#ef4444", constraint: "#f97316", invariant: "#06b6d4", component: "#8b5cf6", decision: "#eab308", principle: "#3b82f6" }
  return colors[type] ?? "#6b7280"
}`
    default:
      return `// TODO: implement ${name}`
  }
}

// ── Script ────────────────────────────────────────────────────────────────────

function renderScript(comp: IRComponent, ir: IR, handlers: Map<string, string>): string {
  const imports: string[] = []
  const statements: string[] = []
  const routerImports = new Set<string>()

  const route = findRouteForComponent(ir, comp.name)
  if (route && route.params.length > 0) {
    routerImports.add("useRoute")
    statements.push(`const route = useRoute()`)
  }

  const needsComputed = new Set<string>()

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
      const hasFilter = filterParam.length > 0
      statements.push(
        `const { items: ${varName}, loading, update: update${capitalize(colId)}, remove: remove${capitalize(colId)} } = ${fnName}(${filterParam})`,
      )

      // If filtered by route param → create a computed `item` for detail pages
      if (hasFilter && route && route.params.length > 0) {
        const paramName = route.params.find((p) => {
          const isPrimaryKey = p === "id" || p.toLowerCase() === `${colId}id` || p === `${colId}Id`
          return isPrimaryKey
        })
        if (paramName) {
          statements.push(`const item = computed(() => ${varName}.value[0] ?? null)`)
          needsComputed.add("computed")
        }
      }
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

  // Add Vue imports as needed
  if (needsComputed.size > 0 || needsRef(comp)) {
    const vueItems: string[] = []
    if (needsComputed.size > 0) vueItems.push("computed")
    if (needsRef(comp)) vueItems.push("ref")
    imports.unshift(`import { ${vueItems.join(", ")} } from "vue"`)
  }

  // Add const declarations first, then function handlers
  const constHandlers: string[] = []
  const funcHandlers: string[] = []
  for (const [key, code] of handlers) {
    if (key.startsWith("const_")) {
      constHandlers.push(code)
    } else {
      funcHandlers.push(code)
    }
  }

  for (const code of constHandlers) {
    statements.push(code)
  }

  for (const code of funcHandlers) {
    statements.push("")
    statements.push(code)
  }

  // Generate helper functions for template calls like getLevelColor()
  const functionCalls = collectFunctionCalls(comp.tree)
  for (const fnName of functionCalls) {
    if (!statements.some((s) => s.includes(`function ${fnName}`))) {
      statements.push("")
      statements.push(generateHelperFunction(fnName))
    }
  }

  if (imports.length === 0 && statements.length === 0) return ""

  const importBlock = imports.length > 0 ? imports.join("\n") + "\n\n" : ""
  return `${importBlock}${statements.join("\n")}`
}

function needsRef(comp: IRComponent): boolean {
  // Check if any child uses modal (needs ref for vModel)
  return hasModal(comp.tree)
}

function hasModal(node: ExtendedComponentNode): boolean {
  if (node.modal) return true
  if (node.bind?.item && hasModal(node.bind.item)) return true
  if (Array.isArray(node.children)) {
    return node.children.some(hasModal)
  }
  return false
}

function buildFilterParam(colId: string, comp: IRComponent, ir: IR): string {
  const route = findRouteForComponent(ir, comp.name)
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
  // If it's already a raw expression (no {{ }}), return as-is
  if (!template.includes("{{")) return template
  const match = template.match(/\{\{\s*(.+?)\s*\}\}/)
  return match ? match[1] : template
}

function resolveExprInString(value: unknown, ir?: IR, compName?: string): string {
  if (typeof value !== "string") return String(value ?? "")
  if (!value.includes("{{")) return value
  const paramMap = buildContextParamMap(ir, compName)

  // First resolve context.xxx → route.params.xxx
  let result = value.replace(/\{\{\s*context\.(\w+)\s*\}\}/g, (_, key: string) => {
    return `\${${paramMap[`context.${key}`] ?? `route.params.${key}`}}`
  })

  // Then resolve remaining {{ expr }} → ${expr} for template literals
  result = result.replace(/\{\{\s*(.+?)\s*\}\}/g, (_, expr: string) => {
    const paramName = paramMap[`context.${expr}`]
    if (paramName) return `\${${paramName}}`
    if (expr === "projectId") return `\${route.params.id}`
    if (expr === "ideaId") return `\${route.params.ideaId}`
    return `\${${expr}}`
  })

  return result
}

/** Resolves template expressions for Vue template content, keeping {{ }} syntax */
function resolveVueTemplateString(value: string, ir?: IR, compName?: string): string {
  if (!value.includes("{{")) return value
  const paramMap = buildContextParamMap(ir, compName)

  return value
    .replace(/\{\{\s*context\.(\w+)\s*\}\}/g, (_, key: string) => {
      const param = paramMap[`context.${key}`] ?? `route.params.${key}`
      return `{{ ${param} }}`
    })
    .replace(/\{\{\s*context\.projectId\s*\}\}/g, "{{ route.params.id }}")
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
