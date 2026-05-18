// ── Script Block Generation ───────────────────────────────────────────────────
// Generates <script setup> content: imports, statements, helper functions.

import type { IR, IRComponent, ExtendedComponentNode } from "../../ir"
import { capitalize, camelCase } from "../../utils"
import { findRouteForComponent, isTranslation } from "../../expressions"
import { collectFromTree, someInTree } from "../../walker"

export function renderScript(comp: IRComponent, ir: IR, handlers: Map<string, string>): string {
  const imports: string[] = []
  const statements: string[] = []
  const routerImports = new Set<string>()
  let needsRef_flag = false
  const rawScript = typeof comp.tree.rawScript === "string" ? comp.tree.rawScript.trim() : ""
  const hasRawScript = rawScript.length > 0

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
  if (!hasRawScript && route && route.params.length > 0) {
    routerImports.add("useRoute")
    statements.push(`const route = useRoute()`)
  }

  const needsComputed = new Set<string>()

  if (!hasRawScript) {
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
            const isPrimaryKey =
              p === "id" || p.toLowerCase() === `${colId}id` || p === `${colId}Id`
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
      imports.push(
        `import { use${capitalize(colId)} } from "@/composables/use${capitalize(colId)}"`,
      )
    }
  }

  // Derive `locales` from app_state singleton when referenced in template
  if (
    !hasRawScript &&
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

  // Generate asset imports (e.g. SVG components)
  for (const asset of ir.assets) {
    if (someInTree(comp.tree, (n) => n.component === asset.name)) {
      imports.unshift(`import ${asset.name} from "@/assets/${asset.src}"`)
    }
  }

  // Generate showSkeleton ref if component has skeleton states
  if (!hasRawScript && hasSkeleton(comp.tree)) {
    statements.push(`const showSkeleton = ref(false)`)
    needsRef_flag = true
  }

  // Generate route param computed variables
  if (!hasRawScript && route && route.params.length > 0) {
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
  if (!hasRawScript && needsRouter) {
    routerImports.add("useRouter")
    statements.push(`const router = useRouter()`)
  }

  if (routerImports.size > 0) {
    imports.unshift(`import { ${[...routerImports].join(", ")} } from "vue-router"`)
  }

  // Check for translations (i18n)
  const hasTranslations = someInTree(comp.tree, (n) => {
    if (isTranslation(n)) return true
    if (typeof n.children === "object" && !Array.isArray(n.children) && isTranslation(n.children))
      return true
    if (n.props) {
      for (const v of Object.values(n.props)) {
        if (typeof v === "object" && v !== null && isTranslation(v)) return true
      }
    }
    return false
  })

  if (hasTranslations) {
    imports.push(`import { useT } from "@exodus/edem-vue"`)
    statements.push(`const t = useT()`)
  }

  if (!hasRawScript && (needsComputed.size > 0 || needsRef_flag || needsRef(comp))) {
    const vueItems: string[] = []
    if (needsComputed.size > 0) vueItems.push("computed")
    if (needsRef_flag || needsRef(comp)) vueItems.push("ref")
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
    if (!statements.some((s) => s.includes(`function ${fnName}`))) {
      statements.push("")
      statements.push(generateHelperFunction(fnName))
    }
  }

  if (hasRawScript) {
    statements.push("")
    statements.push(rawScript)
  }

  if (imports.length === 0 && statements.length === 0) return ""

  const importBlock = imports.length > 0 ? imports.join("\n") + "\n\n" : ""
  return `${importBlock}${statements.join("\n")}`
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
