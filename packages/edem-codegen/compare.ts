import { $ } from "bun"
import { existsSync } from "fs"
import { mkdir, readdir, readFile } from "fs/promises"
import { join, relative } from "path"
import { loadManifests } from "./src/load"
import {
  countBy,
  createEntry,
  shouldSkipDir,
  type Area,
  type CompareContext,
  type DiffEntry,
  type Reason,
} from "./src/compare"

const ROOT = join(import.meta.dir, "../..")
const ORIGINAL = join(ROOT, "apps/exodus")
const GENERATED = join(ROOT, "apps/exodus-generated")
const GENERATED_SRC = join(GENERATED, "src")
const MANIFESTS_DIR = join(ORIGINAL, "edem-manifests")
const GENERATE_SCRIPT = join(import.meta.dir, "generate.ts")

interface Report {
  generated: {
    exists: boolean
    generatedNow: boolean
  }
  summary: {
    total: number
    byArea: Partial<Record<Area, number>>
    byReason: Partial<Record<Reason, number>>
  }
  entries: DiffEntry[]
}

const args = process.argv.slice(2)
const json = args.includes("--json")
const forceGenerate = args.includes("--generate")
const targetFile = args.find((arg) => !arg.startsWith("--"))

const didGenerate = await ensureGeneratedApp(forceGenerate)

if (targetFile) {
  await diffSingleFile(targetFile)
  process.exit(0)
}

const parityReport = await buildReport(didGenerate)

if (json) {
  console.log(JSON.stringify(parityReport, null, 2))
} else {
  printReport(parityReport)
}

async function ensureGeneratedApp(force: boolean): Promise<boolean> {
  const exists = existsSync(GENERATED)

  if (!exists) {
    await mkdir(GENERATED, { recursive: true })
  }

  if (!exists || force || !existsSync(GENERATED_SRC)) {
    await $`bun ${GENERATE_SCRIPT}`
    return true
  }

  return false
}

async function diffSingleFile(file: string): Promise<void> {
  await $`diff -u --label ${`a/${file}`} --label ${`b/${file}`} ${join(ORIGINAL, file)} ${join(GENERATED, file)}`.nothrow()
}

async function buildReport(generatedInThisRun: boolean): Promise<Report> {
  const context = loadCompareContext()
  const referenceFiles = await listTrackedReferenceFiles()
  const generatedFiles = new Set(await walkFiles(GENERATED))
  const allFiles = new Set<string>([...referenceFiles, ...generatedFiles])
  const entries: DiffEntry[] = []

  for (const file of [...allFiles].toSorted()) {
    const referencePath = join(ORIGINAL, file)
    const generatedPath = join(GENERATED, file)
    const hasReference = referenceFiles.has(file)
    const hasGenerated = generatedFiles.has(file)

    if (hasReference && hasGenerated) {
      const [referenceContent, generatedContent] = await Promise.all([
        readFile(referencePath),
        readFile(generatedPath),
      ])

      if (!referenceContent.equals(generatedContent)) {
        entries.push(createEntry(file, "different", context))
      }

      continue
    }

    if (hasReference) {
      entries.push(createEntry(file, "only_in_reference", context))
      continue
    }

    entries.push(createEntry(file, "only_in_generated", context))
  }

  return {
    generated: {
      exists: existsSync(GENERATED_SRC),
      generatedNow: generatedInThisRun,
    },
    summary: {
      total: entries.length,
      byArea: countBy(entries, (entry) => entry.area),
      byReason: countBy(entries, (entry) => entry.reason),
    },
    entries,
  }
}

function loadCompareContext(): CompareContext {
  const manifests = loadManifests(MANIFESTS_DIR)

  return {
    manifestComponents: new Set(Object.keys(manifests.components)),
    routeRoots: collectRouteRoots(manifests.routes.routes),
    manifestAssets: new Set((manifests.assets?.assets ?? []).map((asset) => asset.src)),
  }
}

interface RouteLike {
  root?: string
  children?: RouteLike[]
}

function collectRouteRoots(routes: RouteLike[]): Set<string> {
  const roots = new Set<string>()

  const visit = (items: RouteLike[]) => {
    for (const route of items) {
      if (route.root) {
        roots.add(route.root)
      }

      if (route.children) {
        visit(route.children)
      }
    }
  }

  visit(routes)
  return roots
}

async function listTrackedReferenceFiles(): Promise<Set<string>> {
  const tracked = await $`git -C ${ORIGINAL} ls-files`.quiet()
  const files = tracked.stdout.toString().trim().split("\n").filter(Boolean)

  return new Set(files)
}

async function walkFiles(root: string): Promise<string[]> {
  if (!existsSync(root)) {
    return []
  }

  const files: string[] = []
  const entries = await readdir(root, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = join(root, entry.name)

    if (entry.isDirectory()) {
      if (shouldSkipDir(entry.name)) {
        continue
      }

      files.push(...(await walkFiles(fullPath)))
      continue
    }

    files.push(relative(GENERATED, fullPath))
  }

  return files
}
function printReport(report: Report): void {
  if (report.summary.total === 0) {
    console.log(
      report.generated.generatedNow
        ? "generated app refreshed\nparity: no changes"
        : "parity: no changes",
    )
    return
  }

  const lines: string[] = []

  lines.push(report.generated.generatedNow ? "generated app refreshed" : "generated app reused")
  lines.push(`total differences: ${report.summary.total}`)
  lines.push("")
  lines.push("by area:")

  for (const area of ["shell", "layouts", "pages", "assets", "other"] satisfies Area[]) {
    const count = report.summary.byArea[area] ?? 0
    if (count > 0) {
      lines.push(`- ${area}: ${count}`)
    }
  }

  lines.push("")
  lines.push("by reason:")

  for (const reason of ["schema gap", "generator gap", "migration gap"] satisfies Reason[]) {
    const count = report.summary.byReason[reason] ?? 0
    if (count > 0) {
      lines.push(`- ${reason}: ${count}`)
    }
  }

  for (const area of ["shell", "layouts", "pages", "assets", "other"] satisfies Area[]) {
    const areaEntries = report.entries.filter((entry) => entry.area === area)
    if (areaEntries.length === 0) {
      continue
    }

    lines.push("")
    lines.push(`${area}:`)

    for (const entry of areaEntries) {
      lines.push(`- [${entry.status}] ${entry.file} -> ${entry.reason}`)
    }
  }

  console.log(lines.join("\n"))
}
