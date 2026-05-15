import { $ } from "bun"
import { readdirSync, statSync } from "fs"
import { join, relative, extname } from "path"

const ORIGINAL = import.meta.dir + "/../../apps/exodus"
const GENERATED = import.meta.dir + "/../../apps/exodus-generated"

const IGNORED_DIRS = new Set(["node_modules", ".git", "dist", ".nuxt", ".output", "coverage"])
const BINARY_EXTS = new Set([
  ".png",
  ".ico",
  ".icns",
  ".jpg",
  ".jpeg",
  ".gif",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
])

interface FileDiff {
  path: string
  category: string
  type: "match" | "diff" | "missing" | "extra" | "binary-diff"
  summary?: string
  details?: string[]
}

// ── File listing ──────────────────────────────────────────────────────────────

async function gitLsFiles(dir: string): Promise<Set<string>> {
  try {
    const result = await $`git ls-files`.cwd(dir).quiet()
    return new Set(result.stdout.toString().trim().split("\n").filter(Boolean))
  } catch {
    return new Set()
  }
}

function listFiles(dir: string, base: string = dir): Set<string> {
  const files = new Set<string>()
  const entries = readdirSync(dir)
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry)) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      for (const f of listFiles(full, base)) files.add(f)
    } else {
      files.add(relative(base, full))
    }
  }
  return files
}

// ── Categorization ────────────────────────────────────────────────────────────

function categorize(path: string): string {
  if (path.startsWith("edem-manifests/")) return "manifests"
  if (path.startsWith("src/components/")) return "components"
  if (path.startsWith("src/composables/")) return "composables"
  if (path.startsWith("src/hooks")) return "hooks"
  if (path.startsWith("src/utils/")) return "utils"
  if (path.startsWith("src/bun/")) return "bun"
  if (path.startsWith("src/types/")) return "types"
  if (path.startsWith("assets/")) return "assets"
  if (path.startsWith("scripts/")) return "scripts"
  if (
    path === "package.json" ||
    path === "tsconfig.json" ||
    path === "vite.config.ts" ||
    path === "electrobun.config.ts"
  )
    return "config"
  if (path.endsWith(".vue")) return "components"
  if (path.endsWith(".ts")) return "typescript"
  return "other"
}

// ── Content comparison ────────────────────────────────────────────────────────

function isBinary(path: string): boolean {
  return BINARY_EXTS.has(extname(path).toLowerCase())
}

function extractImports(content: string): string[] {
  const imports: string[] = []
  for (const m of content.matchAll(/^import\s+.*?\s+from\s+["'](.+?)["']/gm)) {
    imports.push(m[1])
  }
  for (const m of content.matchAll(/^import\s+["'](.+?)["']/gm)) {
    imports.push(m[1])
  }
  return imports
}

function extractTemplate(content: string): string {
  const m = content.match(/<template>([\s\S]*?)<\/template>/)
  return m ? m[1].trim() : ""
}

function extractScript(content: string): string {
  const m = content.match(/<script[^>]*>([\s\S]*?)<\/script>/)
  return m ? m[1].trim() : ""
}

function extractVueElements(template: string): Set<string> {
  const elements = new Set<string>()
  for (const m of template.matchAll(/<([A-Z][a-zA-Z0-9]*)/g)) {
    elements.add(m[1])
  }
  return elements
}

function extractVueBindings(template: string): string[] {
  const bindings: string[] = []
  for (const m of template.matchAll(/:(\w+)=/g)) {
    bindings.push(m[1])
  }
  return [...new Set(bindings)]
}

function extractEvents(template: string): string[] {
  const events: string[] = []
  for (const m of template.matchAll(/@(\w+)/g)) {
    events.push(m[1])
  }
  return [...new Set(events)]
}

function extractRoutes(content: string): string[] {
  const routes: string[] = []
  for (const m of content.matchAll(/path:\s*["']([^"']+)["']/g)) {
    routes.push(m[1])
  }
  return routes
}

// ── Deep diff analysis ────────────────────────────────────────────────────────

function diffVueFiles(orig: string, gen: string): { summary: string; details: string[] } {
  const details: string[] = []
  const origTpl = extractTemplate(orig)
  const genTpl = extractTemplate(gen)
  const origScript = extractScript(orig)
  const genScript = extractScript(gen)

  const origImports = extractImports(orig)
  const genImports = extractImports(gen)
  const origElements = extractVueElements(origTpl)
  const genElements = extractVueElements(genTpl)
  const origBindings = extractVueBindings(origTpl)
  const genBindings = extractVueBindings(genTpl)
  const origEvents = extractEvents(origTpl)
  const genEvents = extractEvents(genTpl)

  // Compare imports
  const missingImports = origImports.filter((i) => !genImports.includes(i))
  const extraImports = genImports.filter((i) => !origImports.includes(i))
  if (missingImports.length > 0) details.push(`  missing imports: ${missingImports.join(", ")}`)
  if (extraImports.length > 0) details.push(`  extra imports: ${extraImports.join(", ")}`)

  // Compare template elements
  const missingElements = [...origElements].filter((e) => !genElements.has(e))
  const extraElements = [...genElements].filter((e) => !origElements.has(e))
  if (missingElements.length > 0)
    details.push(`  missing components: ${missingElements.join(", ")}`)
  if (extraElements.length > 0) details.push(`  extra components: ${extraElements.join(", ")}`)

  // Compare bindings
  const missingBindings = origBindings.filter((b) => !genBindings.includes(b))
  const extraBindings = genBindings.filter((b) => !origBindings.includes(b))
  if (missingBindings.length > 0) details.push(`  missing bindings: ${missingBindings.join(", ")}`)
  if (extraBindings.length > 0) details.push(`  extra bindings: ${extraBindings.join(", ")}`)

  // Compare events
  const missingEvents = origEvents.filter((e) => !genEvents.includes(e))
  const extraEvents = genEvents.filter((e) => !origEvents.includes(e))
  if (missingEvents.length > 0) details.push(`  missing events: ${missingEvents.join(", ")}`)
  if (extraEvents.length > 0) details.push(`  extra events: ${extraEvents.join(", ")}`)

  // Compare script functions
  const origFuncs = [...origScript.matchAll(/function\s+(\w+)/g)].map((m) => m[1])
  const genFuncs = [...genScript.matchAll(/function\s+(\w+)/g)].map((m) => m[1])
  const missingFuncs = origFuncs.filter((f) => !genFuncs.includes(f))
  const extraFuncs = genFuncs.filter((f) => !origFuncs.includes(f))
  if (missingFuncs.length > 0) details.push(`  missing functions: ${missingFuncs.join(", ")}`)
  if (extraFuncs.length > 0) details.push(`  extra functions: ${extraFuncs.join(", ")}`)

  // Template length comparison
  const origLines = origTpl.split("\n").length
  const genLines = genTpl.split("\n").length
  details.push(`  template: ${origLines} → ${genLines} lines`)
  details.push(`  script: ${origScript.split("\n").length} → ${genScript.split("\n").length} lines`)

  const summary = `${details.length} differences`
  return { summary, details }
}

function diffRouterFiles(orig: string, gen: string): { summary: string; details: string[] } {
  const details: string[] = []
  const origRoutes = extractRoutes(orig)
  const genRoutes = extractRoutes(gen)

  const missingRoutes = origRoutes.filter((r) => !genRoutes.includes(r))
  const extraRoutes = genRoutes.filter((r) => !origRoutes.includes(r))

  if (missingRoutes.length > 0) details.push(`  missing routes: ${missingRoutes.join(", ")}`)
  if (extraRoutes.length > 0) details.push(`  extra routes: ${extraRoutes.join(", ")}`)
  details.push(`  total routes: ${origRoutes.length} → ${genRoutes.length}`)

  // Check for layout components
  const origHasLayouts =
    orig.includes("ProjectLayout") ||
    orig.includes("FlowEditorLayout") ||
    orig.includes("DebugLayout")
  const genHasLayouts =
    gen.includes("ProjectLayout") || gen.includes("FlowEditorLayout") || gen.includes("DebugLayout")
  if (origHasLayouts && !genHasLayouts) details.push(`  missing layout components in router`)

  return { summary: `${details.length} differences`, details }
}

function diffPackageJson(orig: string, gen: string): { summary: string; details: string[] } {
  const details: string[] = []
  try {
    const o = JSON.parse(orig)
    const g = JSON.parse(gen)

    if (o.name !== g.name) details.push(`  name: "${o.name}" → "${g.name}"`)
    if (o.version !== g.version) details.push(`  version: "${o.version}" → "${g.version}"`)

    const origScripts = Object.keys(o.scripts || {})
    const genScripts = Object.keys(g.scripts || {})
    const missingScripts = origScripts.filter((s) => !genScripts.includes(s))
    const extraScripts = genScripts.filter((s) => !origScripts.includes(s))
    if (missingScripts.length > 0) details.push(`  missing scripts: ${missingScripts.join(", ")}`)
    if (extraScripts.length > 0) details.push(`  extra scripts: ${extraScripts.join(", ")}`)

    const origDeps = Object.keys(o.dependencies || {})
    const genDeps = Object.keys(g.dependencies || {})
    const missingDeps = origDeps.filter((d) => !genDeps.includes(d))
    const extraDeps = genDeps.filter((d) => !origDeps.includes(d))
    if (missingDeps.length > 0) details.push(`  missing deps: ${missingDeps.join(", ")}`)
    if (extraDeps.length > 0) details.push(`  extra deps: ${extraDeps.join(", ")}`)
  } catch {
    details.push(`  failed to parse JSON`)
  }
  return { summary: `${details.length} differences`, details }
}

function diffGenericFiles(orig: string, gen: string): { summary: string; details: string[] } {
  const details: string[] = []
  const origLines = orig.split("\n")
  const genLines = gen.split("\n")

  let diffCount = 0
  const maxLines = Math.max(origLines.length, genLines.length)
  for (let i = 0; i < maxLines; i++) {
    if (origLines[i] !== genLines[i]) diffCount++
  }

  details.push(`  lines: ${origLines.length} → ${genLines.length}`)
  details.push(`  different lines: ${diffCount}`)

  return { summary: `${diffCount} lines differ`, details }
}

function analyzeDiff(
  path: string,
  orig: string,
  gen: string,
): { summary: string; details: string[] } {
  if (path.endsWith(".vue")) return diffVueFiles(orig, gen)
  if (path === "src/router.ts") return diffRouterFiles(orig, gen)
  if (path === "package.json") return diffPackageJson(orig, gen)
  return diffGenericFiles(orig, gen)
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🔍 Deep comparison: exodus vs exodus-generated\n")

  const origFiles = await gitLsFiles(ORIGINAL)
  const genFiles = listFiles(GENERATED)

  const results: FileDiff[] = []
  const byCategory = new Map<string, FileDiff[]>()

  function addToCategory(cat: string, r: FileDiff) {
    results.push(r)
    const list = byCategory.get(cat)
    if (list) list.push(r)
    else byCategory.set(cat, [r])
  }

  // Compare files
  for (const file of origFiles) {
    const cat = categorize(file)
    if (genFiles.has(file)) {
      if (isBinary(file)) {
        const r: FileDiff = {
          path: file,
          category: cat,
          type: "binary-diff",
          summary: "binary file differs (metadata only)",
        }
        addToCategory(cat, r)
      } else {
        const origContent = await Bun.file(`${ORIGINAL}/${file}`).text()
        const genContent = await Bun.file(`${GENERATED}/${file}`).text()
        if (origContent === genContent) {
          const r: FileDiff = { path: file, category: cat, type: "match" }
          addToCategory(cat, r)
        } else {
          const { summary, details } = analyzeDiff(file, origContent, genContent)
          const r: FileDiff = { path: file, category: cat, type: "diff", summary, details }
          addToCategory(cat, r)
        }
      }
    } else {
      const r: FileDiff = { path: file, category: cat, type: "missing" }
      addToCategory(cat, r)
    }
  }

  for (const file of genFiles) {
    if (!origFiles.has(file)) {
      const cat = categorize(file)
      const r: FileDiff = { path: file, category: cat, type: "extra" }
      addToCategory(cat, r)
    }
  }

  // Print grouped by category
  const categories = [...byCategory.keys()].toSorted()
  for (const cat of categories) {
    const items = byCategory.get(cat)!
    const match = items.filter((i) => i.type === "match")
    const diff = items.filter((i) => i.type === "diff" || i.type === "binary-diff")
    const missing = items.filter((i) => i.type === "missing")
    const extra = items.filter((i) => i.type === "extra")

    console.log(`\n${"═".repeat(60)}`)
    console.log(`📁 ${cat.toUpperCase()}`)
    console.log(`${"═".repeat(60)}`)

    if (match.length > 0) {
      console.log(`\n  ✅ Match (${match.length}):`)
      for (const i of match) console.log(`     ${i.path}`)
    }

    if (diff.length > 0) {
      console.log(`\n  ❌ Diff (${diff.length}):`)
      for (const i of diff) {
        console.log(`\n  📄 ${i.path}`)
        if (i.summary) console.log(`     ${i.summary}`)
        if (i.details) {
          for (const d of i.details) console.log(d)
        }
      }
    }

    if (missing.length > 0) {
      console.log(`\n  ⚠️  Missing (${missing.length}):`)
      for (const i of missing) console.log(`     ${i.path}`)
    }

    if (extra.length > 0) {
      console.log(`\n  ➕ Extra (${extra.length}):`)
      for (const i of extra) console.log(`     ${i.path}`)
    }
  }

  // Final summary
  const matchCount = results.filter((r) => r.type === "match").length
  const diffCount = results.filter((r) => r.type === "diff" || r.type === "binary-diff").length
  const missingCount = results.filter((r) => r.type === "missing").length
  const extraCount = results.filter((r) => r.type === "extra").length

  console.log(`\n${"═".repeat(60)}`)
  console.log(
    `📊 TOTAL: ${matchCount} match, ${diffCount} diff, ${missingCount} missing, ${extraCount} extra`,
  )
  console.log(`   Original: ${origFiles.size} files | Generated: ${genFiles.size} files`)
  console.log(`${"═".repeat(60)}`)

  process.exit(diffCount > 0 || missingCount > 0 ? 1 : 0)
}

main()
