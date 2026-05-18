import { $ } from "bun"
import { existsSync } from "fs"
import { mkdir, writeFile } from "fs/promises"
import { join } from "path"
import { buildParityReport, formatParityReport } from "./src/parity"

const ROOT = join(import.meta.dir, "../..")
const ORIGINAL = join(ROOT, "apps/exodus")
const GENERATED = join(ROOT, "apps/exodus-generated")
const GENERATED_SRC = join(GENERATED, "src")
const MANIFESTS_DIR = join(ORIGINAL, "edem-manifests")
const GENERATE_SCRIPT = join(import.meta.dir, "generate.ts")

const args = process.argv.slice(2)
const json = args.includes("--json")
const forceGenerate = args.includes("--generate")
const targetFile = args.find((arg) => !arg.startsWith("--"))

const didGenerate = await ensureGeneratedApp(forceGenerate)

if (targetFile) {
  await diffSingleFile(targetFile)
  process.exit(0)
}

const parityReport = await buildParityReport({
  originalDir: ORIGINAL,
  generatedDir: GENERATED,
  manifestsDir: MANIFESTS_DIR,
  generatedNow: didGenerate,
})

await writeFile(join(GENERATED, "parity-report.json"), JSON.stringify(parityReport, null, 2) + "\n")
await writeFile(join(GENERATED, "parity-report.txt"), formatParityReport(parityReport) + "\n")

if (json) {
  console.log(JSON.stringify(parityReport, null, 2))
} else {
  console.log(formatParityReport(parityReport))
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
