import { join } from "path"
import { writeFileSync } from "fs"
import { createEdem } from "@exodus/edem-core"
import { codegenModule } from "./src/module"
import { loadManifests } from "./src/load"
import { buildParityReport, formatParityReport } from "./src/parity"

const MOCKS_DIR = join(import.meta.dir, "../../apps/exodus/edem-manifests")
const ORIGINAL = join(import.meta.dir, "../../apps/exodus")
const OUTPUT = join(import.meta.dir, "../../apps/exodus-generated")

const manifests = loadManifests(MOCKS_DIR)

const edem = createEdem([codegenModule])
const result = await edem.codegen.generateProject({
  project_id: "exodus-generated",
  output: OUTPUT,
  manifests,
  project_name: "Exodus",
  manifests_dir: MOCKS_DIR,
})

const parityReport = await buildParityReport({
  originalDir: ORIGINAL,
  generatedDir: OUTPUT,
  manifestsDir: MOCKS_DIR,
  generatedNow: true,
})

writeFileSync(
  join(OUTPUT, "parity-report.json"),
  JSON.stringify(parityReport, null, 2) + "\n",
  "utf-8",
)
writeFileSync(join(OUTPUT, "parity-report.txt"), formatParityReport(parityReport) + "\n", "utf-8")

console.log(`${result.files} files → ${result.output}`)
