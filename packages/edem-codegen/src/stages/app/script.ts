// ── Script Block Generation ───────────────────────────────────────────────────
// Generates <script setup> content: imports, statements, helper functions.

import type { IR, IRComponent, ExtendedComponentNode } from "../../ir"
import { capitalize, camelCase } from "../../utils"
import { findRouteForComponent, isTranslation, renderT } from "../../expressions"
import { collectFromTree, someInTree } from "../../walker"

export function renderScript(comp: IRComponent, ir: IR, handlers: Map<string, string>): string {
  const imports: string[] = []
  const statements: string[] = []
  const routerImports = new Set<string>()
  let needsRefFlag = false
  const componentQueries = comp.tree.queries ?? {}
  const componentState = comp.tree.state ?? {}
  const componentConstants = comp.tree.constants ?? {}
  const componentComputed = comp.tree.computed ?? {}
  const componentActions = comp.tree.actions ?? {}

  const assetNames = new Set(ir.assets.map((asset) => asset.name))
  const componentNames = new Set(ir.components.map((component) => component.name))
  const localComponentImports = new Set(
    collectFromTree(comp.tree, (node) => {
      const name = node.component
      if (
        !componentNames.has(name) ||
        name === comp.name ||
        assetNames.has(name) ||
        name === "RouterLink" ||
        name === "RouterView" ||
        name === "Teleport" ||
        name === "Transition" ||
        name.startsWith("U") ||
        name[0] === name[0].toLowerCase()
      ) {
        return []
      }

      return [name]
    }),
  )

  for (const componentName of [...localComponentImports].toSorted()) {
    imports.unshift(`import ${componentName} from "@/components/${componentName}.vue"`)
  }

  const route = findRouteForComponent(ir, comp.name)
  const needsRoute = componentUsesRoute(comp, ir)
  const needsRouteParams = componentNeedsRouteParams(comp, ir)
  if (needsRoute) {
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

    imports.push(`import { use${capitalize(colId)} } from "@/composables/use${capitalize(colId)}"`)
  }

  // Derive `locales` from app_state singleton when referenced in template
  if (
    comp.usedCollections.includes("app_state") &&
    someInTree(comp.tree, (n) => {
      if (typeof n.bind?.items === "string" && n.bind.items.includes("locales")) return true
      return false
    })
  ) {
    statements.push(
      `const locales = computed(() => (appState.value?.data?.locales ?? []) as { value: string; label: string; flag: string }[])`,
    )
    needsComputed.add("computed")
  }

  const manifestCollections = new Set<string>()
  for (const [name, query] of Object.entries(componentQueries)) {
    const colId = query.collection
    manifestCollections.add(colId)
    imports.push(`import { use${capitalize(colId)} } from "@/composables/use${capitalize(colId)}"`)

    if (query.kind === "singleton") {
      statements.push(
        `const { item: ${name}, loading: ${name}Loading, update: update${capitalize(colId)} } = use${capitalize(colId)}()`,
      )
      continue
    }

    const options = renderScriptValue(buildQueryOptions(query.filter, query.sort))
    statements.push(
      `const { items: ${name}, loading: ${name}Loading, create: create${capitalize(colId)}, update: update${capitalize(colId)}, remove: remove${capitalize(colId)} } = use${capitalize(colId)}(${options})`,
    )
  }

  if (Object.keys(componentState).length > 0) {
    needsRefFlag = true
    for (const [name, value] of Object.entries(componentState)) {
      statements.push(`const ${name} = ref(${renderScriptValue(value)})`)
    }
  }

  for (const [name, value] of Object.entries(componentConstants)) {
    statements.push(`const ${name} = ${renderScriptValue(value)}`)
  }

  if (Object.keys(componentComputed).length > 0) {
    needsComputed.add("computed")
    for (const [name, expression] of Object.entries(componentComputed)) {
      statements.push(`const ${name} = computed(() => ${extractScriptExpr(expression)})`)
    }
  }

  // Generate asset imports (e.g. SVG components)
  for (const asset of ir.assets) {
    if (someInTree(comp.tree, (n) => n.component === asset.name)) {
      imports.unshift(`import ${asset.name} from "@/assets/${asset.src}"`)
    }
  }

  // Generate showSkeleton ref if component has skeleton states
  if (hasSkeleton(comp.tree) && !Object.hasOwn(componentState, "showSkeleton")) {
    statements.push(`const showSkeleton = ref(false)`)
    needsRefFlag = true
  }

  // Generate route param computed variables
  if (needsRouteParams && route) {
    for (const param of route.params) {
      if (param.includes("(") || param.includes("*") || param.includes(".")) continue
      statements.push(`const ${param} = computed(() => route.params.${param})`)
      needsComputed.add("computed")
    }
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

  // Check for translations (i18n)
  const hasTranslations =
    someInTree(comp.tree, (n) => {
      if (isTranslation(n)) return true
      if (typeof n.children === "object" && !Array.isArray(n.children) && isTranslation(n.children))
        return true
      if (n.props) {
        for (const v of Object.values(n.props)) {
          if (typeof v === "object" && v !== null && isTranslation(v)) return true
        }
      }
      return false
    }) || hasTranslationValue(comp.tree.constants)

  if (hasTranslations) {
    imports.push(`import { useT } from "@exodus/edem-vue"`)
    statements.push(`const t = useT()`)
  }

  if (usesProps(comp)) {
    statements.push(`const props = defineProps<{ [key: string]: unknown }>()`)
  }

  for (const [name, action] of Object.entries(componentActions)) {
    if (action.steps.some((step) => step.type === "navigate")) {
      routerImports.add("useRouter")
    }
    statements.push("")
    statements.push(renderManifestAction(name, action.steps))
  }

  if (needsComputed.size > 0 || needsRefFlag || needsRef(comp)) {
    const vueItems: string[] = []
    if (needsComputed.size > 0) vueItems.push("computed")
    if (needsRefFlag || needsRef(comp)) vueItems.push("ref")
    imports.unshift(`import { ${vueItems.join(", ")} } from "vue"`)
  }

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

  const functionCalls = collectFunctionCalls(comp.tree)
  for (const fnName of functionCalls) {
    if (isIdentifierDeclared(fnName, imports, statements)) continue
    statements.push("")
    statements.push(generateHelperFunction(fnName))
  }

  if (imports.length === 0 && statements.length === 0) return ""

  const importBlock = imports.length > 0 ? [...new Set(imports)].join("\n") + "\n\n" : ""
  return `${importBlock}${statements.join("\n")}`
}

function componentNeedsRouteParams(comp: IRComponent, ir: IR): boolean {
  const route = findRouteForComponent(ir, comp.name)
  if (!route || route.params.length === 0) {
    return false
  }

  if (comp.usedCollections.some((colId) => buildFilterParam(colId, comp, ir).length > 0)) {
    return true
  }

  const treeContent = JSON.stringify(comp.tree)
  const extraContent = JSON.stringify({
    queries: comp.tree.queries,
    constants: comp.tree.constants,
    computed: comp.tree.computed,
    actions: comp.tree.actions,
  })
  return route.params.some((param) => {
    const short = param.replace(/Id$/, "")
    return (
      treeContent.includes(`context.${param}`) ||
      treeContent.includes(`context.${short}`) ||
      treeContent.includes(`{{ ${param} }}`) ||
      treeContent.includes(`{{ ${short} }}`) ||
      extraContent.includes(`route.params.${param}`) ||
      extraContent.includes(`route.params.${short}`)
    )
  })
}

function componentUsesRoute(comp: IRComponent, ir: IR): boolean {
  if (componentNeedsRouteParams(comp, ir)) {
    return true
  }

  return JSON.stringify({
    tree: comp.tree,
    queries: comp.tree.queries,
    constants: comp.tree.constants,
    computed: comp.tree.computed,
    actions: comp.tree.actions,
  }).includes("route.")
}

function needsRef(comp: IRComponent): boolean {
  return someInTree(comp.tree, (n) => !!n.modal)
}

function hasSkeleton(node: ExtendedComponentNode): boolean {
  return someInTree(node, (n) => {
    if (n.skeleton) return true
    if (Array.isArray(n.children)) {
      return n.children.some(
        (c) =>
          typeof c === "object" &&
          "component" in c &&
          (c as ExtendedComponentNode).component === "USkeleton",
      )
    }
    return false
  })
}

function collectFunctionCalls(node: ExtendedComponentNode): Set<string> {
  const calls = collectFromTree(node, (n) => {
    const result: string[] = []
    if (n.props) {
      for (const value of Object.values(n.props)) {
        if (typeof value === "string") {
          for (const m of value.matchAll(/\{\{\s*(\w+)\s*\(/g)) result.push(m[1])
        }
      }
    }
    if (typeof n.children === "string") {
      for (const m of n.children.matchAll(/\{\{\s*(\w+)\s*\(/g)) result.push(m[1])
    }
    return result
  })
  return new Set(calls)
}

function isIdentifierDeclared(name: string, imports: string[], statements: string[]): boolean {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const declarationPattern = new RegExp(
    String.raw`\b(?:function|const|let|var|class)\s+${escapedName}\b|\bimport\s+${escapedName}\b|\bimport\s*\{[^}]*\b${escapedName}\b[^}]*\}`,
  )
  const sources = [...imports, ...statements]
  return sources.some((source) => declarationPattern.test(source))
}

function usesProps(comp: IRComponent): boolean {
  return JSON.stringify(comp.tree).includes("props.")
}

function buildQueryOptions(
  filter?: Record<string, unknown>,
  sort?: string[],
): Record<string, unknown> {
  const options: Record<string, unknown> = {}
  if (filter && Object.keys(filter).length > 0) {
    options.filter = filter
  }
  if (sort && sort.length > 0) {
    options.sort = sort
  }
  return options
}

function renderScriptValue(value: unknown): string {
  if (typeof value === "string") {
    const exactExpr = value.match(/^\{\{\s*([\s\S]+?)\s*\}\}$/)
    if (exactExpr) {
      return exactExpr[1]
    }

    if (value.includes("{{")) {
      return `\`${value.replace(/\{\{\s*([\s\S]+?)\s*\}\}/g, "${$1}")}\``
    }

    return JSON.stringify(value)
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value)
  }

  if (value === null) {
    return "null"
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => renderScriptValue(item)).join(", ")}]`
  }

  if (isTranslation(value)) {
    return renderT(value)
  }

  if (typeof value === "object" && value !== null) {
    return `{ ${Object.entries(value)
      .map(([key, entryValue]) => `${JSON.stringify(key)}: ${renderScriptValue(entryValue)}`)
      .join(", ")} }`
  }

  return "undefined"
}

function extractScriptExpr(expression: string): string {
  const exactExpr = expression.match(/^\{\{\s*([\s\S]+?)\s*\}\}$/)
  return exactExpr ? exactExpr[1] : expression
}

function renderManifestAction(name: string, steps: Array<Record<string, unknown>>): string {
  const lines = [`async function ${name}($event?: Event, item?: Record<string, unknown>) {`]

  for (const step of steps) {
    switch (step.type) {
      case "guard": {
        const condition = extractScriptExpr(String(step.condition))
        lines.push(step.unless ? `  if (${condition}) return` : `  if (!(${condition})) return`)
        break
      }
      case "set-state": {
        lines.push(`  ${String(step.state)}.value = ${renderScriptValue(step.value)}`)
        break
      }
      case "set-timeout-state": {
        lines.push(
          `  setTimeout(() => { ${String(step.state)}.value = ${renderScriptValue(step.value)} }, ${Number(step.delay)})`,
        )
        break
      }
      case "create-item": {
        const data = renderScriptValue(step.data ?? {})
        const call = `await create${capitalize(String(step.collection))}(${data})`
        if (step.assignTo) {
          lines.push(`  const ${String(step.assignTo)}Result = ${call}`)
          lines.push(
            `  const ${String(step.assignTo)} = typeof ${String(step.assignTo)}Result === "string" ? ${String(step.assignTo)}Result : ${String(step.assignTo)}Result.id`,
          )
        } else {
          lines.push(`  ${call}`)
        }
        break
      }
      case "update-item": {
        lines.push(
          `  await update${capitalize(String(step.collection))}(${extractScriptExpr(String(step.id))}, ${renderScriptValue(step.data)})`,
        )
        break
      }
      case "delete-item": {
        lines.push(
          `  await remove${capitalize(String(step.collection))}(${extractScriptExpr(String(step.id))})`,
        )
        break
      }
      case "update-singleton": {
        lines.push(
          `  await update${capitalize(String(step.collection))}(${renderScriptValue(step.data)})`,
        )
        break
      }
      case "navigate": {
        lines.push(`  await router.push(${renderScriptValue(step.to)})`)
        break
      }
      case "clipboard-write": {
        lines.push(`  await navigator.clipboard.writeText(${renderScriptValue(step.text)})`)
        break
      }
      case "event": {
        if (step.preventDefault) lines.push(`  $event?.preventDefault()`)
        if (step.stopPropagation) lines.push(`  $event?.stopPropagation()`)
        break
      }
    }
  }

  lines.push("}")
  return lines.join("\n")
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
    const paramNameLower = param.replace(/Id$/, "").toLowerCase()
    const colIdLower = colId.toLowerCase()
    const isPrimaryKey =
      param === "id" ||
      param.toLowerCase() === `${colId}id` ||
      param === `${colId}Id` ||
      paramNameLower === colIdLower
    if (isPrimaryKey && !filters.some((f) => f.startsWith("id:"))) {
      filters.push(`id: { _eq: route.params.${param} }`)
    }
  }

  if (filters.length === 0) return ""
  return `{ filter: { ${filters.join(", ")} } }`
}

function generateHelperFunction(name: string): string {
  switch (name) {
    case "getIdeaTypeColor":
      return `function getIdeaTypeColor(type: string): string {
  const colors: Record<string, string> = { goal: "#22c55e", non_goal: "#ef4444", constraint: "#f97316", invariant: "#06b6d4", component: "#8b5cf6", decision: "#eab308", principle: "#3b82f6" }
  return colors[type] ?? "#6b7280"
}`
    case "getInitials":
      return `function getInitials(name: string): string {
  return name.slice(0, 2).toUpperCase()
}`
    case "formatTime":
      return `function formatTime(ts: number | string | Date): string {
  const d = new Date(ts)
  return d.toLocaleTimeString()
}`
    default:
      return `// TODO: implement ${name}`
  }
}

function hasTranslationValue(value: unknown): boolean {
  if (isTranslation(value)) {
    return true
  }

  if (Array.isArray(value)) {
    return value.some((entry) => hasTranslationValue(entry))
  }

  if (typeof value === "object" && value !== null) {
    return Object.values(value).some((entry) => hasTranslationValue(entry))
  }

  return false
}
