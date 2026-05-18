import { $ } from "bun"
import { existsSync } from "fs"
import { readdir, readFile } from "fs/promises"
import { join, relative } from "path"
import {
  countBy,
  createEntry,
  shouldSkipDir,
  type Area,
  type CompareContext,
  type DiffEntry,
  type Reason,
} from "./compare"
import { loadManifests } from "./load"

export interface ParityReport {
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

interface BuildParityReportInput {
  originalDir: string
  generatedDir: string
  manifestsDir: string
  generatedNow: boolean
}

interface RouteLike {
  root?: string
  children?: RouteLike[]
}

export async function buildParityReport(input: BuildParityReportInput): Promise<ParityReport> {
  const context = loadCompareContext(input.manifestsDir)
  const referenceFiles = await listTrackedReferenceFiles(input.originalDir)
  const generatedFiles = new Set(await walkFiles(input.generatedDir, input.generatedDir))
  const allFiles = new Set<string>([...referenceFiles, ...generatedFiles])
  const entries: DiffEntry[] = []

  for (const file of [...allFiles].toSorted()) {
    const referencePath = join(input.originalDir, file)
    const generatedPath = join(input.generatedDir, file)
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
      exists: existsSync(join(input.generatedDir, "src")),
      generatedNow: input.generatedNow,
    },
    summary: {
      total: entries.length,
      byArea: countBy(entries, (entry) => entry.area),
      byReason: countBy(entries, (entry) => entry.reason),
    },
    entries,
  }
}

export function formatParityReport(report: ParityReport): string {
  if (report.summary.total === 0) {
    return report.generated.generatedNow
      ? "generated app refreshed\nparity: no changes"
      : "parity: no changes"
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

  return lines.join("\n")
}

function loadCompareContext(manifestsDir: string): CompareContext {
  const manifests = loadManifests(manifestsDir)

  return {
    manifestComponents: new Set(Object.keys(manifests.components)),
    routeRoots: collectRouteRoots(manifests.routes.routes),
    manifestAssets: new Set((manifests.assets?.assets ?? []).map((asset) => asset.src)),
  }
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

async function listTrackedReferenceFiles(originalDir: string): Promise<Set<string>> {
  const tracked = await $`git -C ${originalDir} ls-files`.quiet()
  const files = tracked.stdout.toString().trim().split("\n").filter(Boolean)

  return new Set(files)
}

async function walkFiles(root: string, baseDir: string): Promise<string[]> {
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

      files.push(...(await walkFiles(fullPath, baseDir)))
      continue
    }

    if (entry.name === "parity-report.json" || entry.name === "parity-report.txt") {
      continue
    }

    files.push(relative(baseDir, fullPath))
  }

  return files
}
