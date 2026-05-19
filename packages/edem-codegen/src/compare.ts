import { basename, extname } from "path"

const SHELL_FILES = new Set([
  "index.html",
  "vite.config.ts",
  "tsconfig.json",
  "src/App.vue",
  "src/main.ts",
  "src/router.ts",
  "src/app.css",
  "src/env.d.ts",
])

const LAYOUT_COMPONENTS = new Set(["AppSidebar", "AppTopMenu", "ProjectsSidebar"])
const TEXT_PARITY_EXTENSIONS = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".sh",
  ".toml",
  ".ts",
  ".tsx",
  ".vue",
])

export type Area = "shell" | "layouts" | "pages" | "assets" | "other"
export type Reason = "schema gap" | "generator gap" | "migration gap"
export type Status = "different" | "only_in_reference" | "only_in_generated"

export interface DiffEntry {
  file: string
  area: Area
  reason: Reason
  status: Status
}

export interface CompareContext {
  manifestComponents: Set<string>
  routeRoots: Set<string>
  manifestAssets: Set<string>
}

export function createEntry(file: string, status: Status, context: CompareContext): DiffEntry {
  const area = classifyArea(file, context)
  return {
    file,
    area,
    reason: classifyReason(file, area, status, context),
    status,
  }
}

export function classifyArea(file: string, context: CompareContext): Area {
  if (file.startsWith("assets/") || file.startsWith("src/assets/")) {
    return "assets"
  }

  if (SHELL_FILES.has(file)) {
    return "shell"
  }

  if (file.startsWith("src/components/")) {
    const componentName = componentNameFromFile(file)

    if (componentName && isLayoutComponent(componentName)) {
      return "layouts"
    }

    if (componentName && context.routeRoots.has(componentName)) {
      return "pages"
    }
  }

  return "other"
}

export function classifyReason(
  file: string,
  area: Area,
  status: Status,
  context: CompareContext,
): Reason {
  if (status === "only_in_generated") {
    return "generator gap"
  }

  if (area === "shell") {
    return "generator gap"
  }

  if (area === "assets") {
    return context.manifestAssets.has(basename(file)) ? "generator gap" : "migration gap"
  }

  const componentName = componentNameFromFile(file)

  if (area === "pages" || area === "layouts") {
    if (componentName && context.manifestComponents.has(componentName)) {
      return "generator gap"
    }

    return "migration gap"
  }

  if (componentName && context.manifestComponents.has(componentName)) {
    return "generator gap"
  }

  return "schema gap"
}

export function componentNameFromFile(file: string): string | null {
  if (!file.startsWith("src/components/") || extname(file) !== ".vue") {
    return null
  }

  return basename(file, ".vue")
}

export function isLayoutComponent(componentName: string): boolean {
  return componentName.endsWith("Layout") || LAYOUT_COMPONENTS.has(componentName)
}

export function shouldSkipDir(name: string): boolean {
  return name === "node_modules" || name === "dist" || name === ".git"
}

export function contentsMatchForParity(
  file: string,
  reference: Uint8Array,
  generated: Uint8Array,
): boolean {
  if (Buffer.from(reference).equals(Buffer.from(generated))) {
    return true
  }

  if (!isTextParityFile(file)) {
    return false
  }

  return normalizeTextForParity(reference) === normalizeTextForParity(generated)
}

export function countBy<T extends string>(
  entries: DiffEntry[],
  pick: (entry: DiffEntry) => T,
): Partial<Record<T, number>> {
  const counts: Partial<Record<T, number>> = {}

  for (const entry of entries) {
    const key = pick(entry)
    counts[key] = (counts[key] ?? 0) + 1
  }

  return counts
}

function isTextParityFile(file: string): boolean {
  return TEXT_PARITY_EXTENSIONS.has(extname(file))
}

function normalizeTextForParity(content: Uint8Array): string {
  return normalizeVueTagAttributeOrder(
    normalizeImportOrder(
      Buffer.from(content)
        .toString("utf8")
        .replaceAll("\r\n", "\n")
        .split("\n")
        .map((line) => line.trimEnd())
        .filter((line) => line.length > 0)
        .join("\n"),
    ),
  )
}

function normalizeImportOrder(content: string): string {
  const lines = content.split("\n")
  const imports = lines.filter((line) => line.startsWith("import ") && line.includes(" from "))

  if (imports.length < 2) {
    return normalizeVueInterpolations(content)
  }

  const sortedImports = imports.toSorted()
  const bodyLines = lines.filter((line) => !(line.startsWith("import ") && line.includes(" from ")))

  return normalizeVueInterpolations([...sortedImports, ...bodyLines].join("\n"))
}

function normalizeVueInterpolations(content: string): string {
  return content
    .replace(/>\s*\n\s*\{\{/g, ">{{")
    .replace(/\}\}\s*\n\s*<\//g, "}}</")
    .replace(/\{\{([\s\S]*?)\}\}/g, (_match, expression: string) => {
      return `{{ ${expression.replace(/\s+/g, " ").trim()} }}`
    })
}

function normalizeVueTagAttributeOrder(content: string): string {
  return content.replace(
    /<([A-Za-z][^\s/>]*)([^<>]*?)(\s*\/?)>/g,
    (_match, tag, rawAttrs, close) => {
      const attrs = [...rawAttrs.matchAll(/\s+[^\s=/>]+(?:=(?:"[^"]*"|'[^']*'|`[^`]*`))?/g)].map(
        (entry) => entry[0].trim(),
      )

      if (attrs.length < 2) {
        return `<${tag}${rawAttrs}${close}>`
      }

      const sortedAttrs = attrs.toSorted((a, b) => a.localeCompare(b))
      return `<${tag} ${sortedAttrs.join(" ")}${close}>`
    },
  )
}
