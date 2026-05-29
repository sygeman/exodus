import { writeFileSync } from "node:fs"
import { join } from "node:path"

const OUTPUT = join(import.meta.dirname, "../apps/exodus/src/generated-nuxt-ui-meta.ts")
const API_URL = "https://ui.nuxt.com/api/component-meta.json"

type ComponentMeta = {
  pascalName: string
  kebabName: string
  meta: {
    props: Array<{
      name: string
      type: string
      description?: string
      required?: boolean
      default?: unknown
      tags?: Array<{ name: string; text: string }>
    }>
  }
}

const SKIP_PROPS = new Set([
  "class",
  "ui",
  "as",
  "slots",
  "onClick",
  "onUpdate:modelValue",
  "onBlur",
  "onChange",
  "activeClass",
  "exactActiveClass",
  "inactiveClass",
  "ariaCurrentValue",
  "prefetchedClass",
  "referrerpolicy",
  "hreflang",
  "media",
  "ping",
  "formaction",
  "formenctype",
  "formmethod",
  "formnovalidate",
  "formtarget",
  "modelModifiers",
])

const STYLE_VARIANT_PROPS = new Set([
  "color",
  "activeColor",
  "variant",
  "activeVariant",
  "size",
  "orientation",
  "side",
  "position",
  "indicator",
])

function shouldSkipProp(name: string): boolean {
  return SKIP_PROPS.has(name) || name.startsWith("on")
}

function extractEnumValues(type: string): string[] {
  const matches = type.match(/"([^"]+)"/g)
  if (!matches) return []
  return matches.map((m) => m.replace(/"/g, "")).filter((v) => v !== "undefined")
}

function extractDefaultValue(prop: ComponentMeta["meta"]["props"][0]): string | undefined {
  if (prop.tags) {
    for (const tag of prop.tags) {
      if (tag.name === "defaultValue") {
        return tag.text.replace(/^['"]|['"]$/g, "").trim()
      }
    }
  }
  if (prop.default !== undefined && prop.default !== null) {
    return String(prop.default)
  }
  return undefined
}

function categorizePropType(type: string, enumValues: string[]): string {
  const lower = type.toLowerCase()
  if (lower === "boolean" || lower === "booleanish") return "boolean"
  if (lower === "number") return "number"
  if (enumValues.length >= 2) return "enum"
  if (lower.includes("string")) return "string"
  if (lower.includes("number")) return "number"
  if (lower.includes("boolean")) return "boolean"
  if (lower.includes("object") || lower.includes("record")) return "object"
  if (lower.includes("array") || lower.endsWith("[]")) return "array"
  return "string"
}

function getComponentCategory(pascalName: string): string {
  const n = pascalName.toLowerCase()
  if (
    n.includes("input") ||
    n.includes("textarea") ||
    n.includes("select") ||
    n.includes("switch") ||
    n.includes("checkbox") ||
    n.includes("radio") ||
    n.includes("slider") ||
    n.includes("form") ||
    n.includes("pin") ||
    n.includes("calendar") ||
    n.includes("file") ||
    n.includes("colorpicker")
  )
    return "form"
  if (
    n.includes("table") ||
    n.includes("pagination") ||
    n.includes("tree") ||
    n.includes("timeline") ||
    n.includes("breadcrumb")
  )
    return "data"
  if (
    n.includes("alert") ||
    n.includes("empty") ||
    n.includes("skeleton") ||
    n.includes("progress") ||
    n.includes("chip") ||
    n.includes("badge") ||
    n.includes("icon") ||
    n.includes("avatar") ||
    n.includes("kbd") ||
    n.includes("separator") ||
    n.includes("toast") ||
    n.includes("error")
  )
    return "feedback"
  if (
    n.includes("modal") ||
    n.includes("drawer") ||
    n.includes("slideover") ||
    n.includes("popover") ||
    n.includes("tooltip") ||
    n.includes("dropdown") ||
    n.includes("context") ||
    n.includes("overlay")
  )
    return "overlay"
  if (
    n.includes("link") ||
    n.includes("navigation") ||
    n.includes("menu") ||
    n.includes("command") ||
    n.includes("button")
  )
    return "navigation"
  if (
    n.includes("page") ||
    n.includes("container") ||
    n.includes("header") ||
    n.includes("footer") ||
    n.includes("sidebar") ||
    n.includes("card") ||
    n.includes("accordion") ||
    n.includes("tabs") ||
    n.includes("collapsible") ||
    n.includes("stepper") ||
    n.includes("dashboard") ||
    n.includes("scroll") ||
    n.includes("main") ||
    n.includes("separator")
  )
    return "layout"
  return "other"
}

const CONTAINER_COMPONENTS = new Set([
  "UCard",
  "UModal",
  "UDrawer",
  "UForm",
  "UContainer",
  "UPage",
  "UPageBody",
  "UPageHeader",
  "UPageSection",
  "UTooltip",
  "UPopover",
  "UCollapsible",
  "UHeader",
  "UFooter",
  "USidebar",
  "UMain",
  "ULink",
  "UButton",
  "UChip",
  "UFormField",
  "UAccordion",
  "UTabs",
  "UStepper",
  "UDashboard",
  "UPageAside",
  "UPageCard",
  "UPageHero",
  "UPageCTA",
  "UPageColumns",
  "UPageGrid",
  "UPageList",
  "UChatPalette",
  "UChatPrompt",
])

function isContainer(pascalName: string): boolean {
  return CONTAINER_COMPONENTS.has(pascalName)
}

async function generate(): Promise<void> {
  console.log("Fetching component metadata from ui.nuxt.com...")

  const res = await fetch(API_URL)
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`)

  const allMeta = (await res.json()) as Record<string, ComponentMeta>

  const uiComponents = Object.entries(allMeta)
    .filter(([key]) => key.startsWith("U") && !key.startsWith("Prose"))
    .toSorted(([a], [b]) => a.localeCompare(b))

  console.log(`  Found ${uiComponents.length} UI components`)

  const lines: string[] = [
    "// Generated by scripts/generate-nuxt-ui-meta.ts via ui.nuxt.com API — do not edit manually",
    "",
    "export type NuiPropMeta = {",
    "  type: string",
    "  defaultValue?: string",
    "  description?: string",
    "  enum?: string[]",
    "}",
    "",
    "export type NuiComponentMeta = {",
    "  name: string",
    "  category: string",
    "  isContainer: boolean",
    "  variants: Record<string, string[]>",
    "  props: Record<string, NuiPropMeta>",
    "  defaults: Record<string, unknown>",
    "}",
    "",
    "export const NUI_COMPONENTS: Record<string, NuiComponentMeta> = {",
  ]

  let propsTotal = 0
  let variantsTotal = 0

  for (const [key, comp] of uiComponents) {
    const pascalName = comp.pascalName || key
    const variants: Record<string, string[]> = {}
    const props: Record<string, Record<string, unknown>> = {}
    const defaults: Record<string, unknown> = {}

    for (const prop of comp.meta.props) {
      if (shouldSkipProp(prop.name)) continue

      const enumValues = extractEnumValues(prop.type)
      const propType = categorizePropType(prop.type, enumValues)
      const defaultValue = extractDefaultValue(prop)
      const description = prop.description || undefined

      const entry: Record<string, unknown> = { type: propType }
      if (defaultValue !== undefined) entry.defaultValue = defaultValue
      if (description) entry.description = description
      if (enumValues.length > 0 && propType === "enum") entry.enum = enumValues

      props[prop.name] = entry

      if (propType === "enum" && enumValues.length >= 2 && STYLE_VARIANT_PROPS.has(prop.name)) {
        variants[prop.name] = enumValues
        variantsTotal++
      }

      if (defaultValue !== undefined) {
        defaults[prop.name] = defaultValue
      }

      propsTotal++
    }

    const variantsEntries = Object.entries(variants)
      .map(([k, vals]) => `${k}: [${vals.map((v) => JSON.stringify(v)).join(", ")}]`)
      .join(", ")

    const propsEntries = Object.entries(props)
      .map(([k, meta]) => {
        const parts: string[] = [`type: "${meta.type}"`]
        if (meta.defaultValue !== undefined)
          parts.push(`defaultValue: ${JSON.stringify(meta.defaultValue)}`)
        if (meta.description) parts.push(`description: ${JSON.stringify(meta.description)}`)
        if (meta.enum)
          parts.push(`enum: [${(meta.enum as string[]).map((v) => JSON.stringify(v)).join(", ")}]`)
        return `${k}: { ${parts.join(", ")} }`
      })
      .join(", ")

    const defaultsEntries = Object.entries(defaults)
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join(", ")

    lines.push(`  ${pascalName}: {`)
    lines.push(`    name: "${pascalName}",`)
    lines.push(`    category: "${getComponentCategory(pascalName)}",`)
    lines.push(`    isContainer: ${isContainer(pascalName)},`)
    lines.push(`    variants: { ${variantsEntries} },`)
    lines.push(`    props: { ${propsEntries} },`)
    lines.push(`    defaults: { ${defaultsEntries} },`)
    lines.push(`  },`)
  }

  lines.push("}")
  lines.push("")
  lines.push("export const NUI_COMPONENT_NAMES = Object.keys(NUI_COMPONENTS)")
  lines.push("")

  // Generate NUI_COMPONENTS_BY_CATEGORY as a literal
  const categories: Record<string, string[]> = {}
  for (const [key, comp] of uiComponents) {
    const cat = getComponentCategory(comp.pascalName || key)
    if (!categories[cat]) categories[cat] = []
    categories[cat].push(comp.pascalName || key)
  }

  lines.push("export const NUI_COMPONENTS_BY_CATEGORY: Record<string, NuiComponentMeta[]> = {")
  for (const [cat, names] of Object.entries(categories)) {
    lines.push(`  ${cat}: [${names.map((n) => `NUI_COMPONENTS.${n}`).join(", ")}],`)
  }
  lines.push("}")
  lines.push("")

  writeFileSync(OUTPUT, lines.join("\n"), "utf-8")
  console.log(`  Props total: ${propsTotal}`)
  console.log(`  Variants total: ${variantsTotal}`)
  console.log(`  Output: ${OUTPUT}`)
  console.log("Done.")
}

await generate()
