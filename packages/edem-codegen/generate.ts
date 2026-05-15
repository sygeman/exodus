import { join } from "path"
import { createEdem } from "@exodus/edem-core"
import { codegenModule } from "./src/module"
import { loadManifests } from "./src/load"

const MOCKS_DIR = join(import.meta.dir, "../../apps/exodus/edem-manifests")
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
console.log(`${result.files} files → ${result.output}`)
