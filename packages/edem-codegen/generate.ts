import { readFileSync } from "fs"
import { join } from "path"
import { createEdem } from "@exodus/edem-core"
import { codegenModule } from "./src/module"

const MOCKS_DIR = join(import.meta.dir, "src/__mocks__")
const OUTPUT = join(import.meta.dir, "../../apps/exodus-app")

const manifests = {
  ui: JSON.parse(readFileSync(join(MOCKS_DIR, "ui.json"), "utf-8")),
  data: JSON.parse(readFileSync(join(MOCKS_DIR, "data.json"), "utf-8")),
  flows: JSON.parse(readFileSync(join(MOCKS_DIR, "flows.json"), "utf-8")),
}

const edem = createEdem([codegenModule])
const result = await edem.codegen.generateProject({
  project_id: "exodus-app",
  output: OUTPUT,
  manifests,
})
console.log(`${result.files} files → ${result.output}`)
