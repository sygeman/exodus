import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { existsSync, rmSync, readdirSync } from "fs"
import { join } from "path"
import { createEdem } from "@exodus/edem-core"
import { codegenModule } from "./module"
import { loadManifests } from "./load"

const TEST_OUTPUT = join(import.meta.dir, "__test_output__")
const MOCKS_DIR = join(import.meta.dir, "__mocks__")

function cleanup() {
  if (existsSync(TEST_OUTPUT)) {
    rmSync(TEST_OUTPUT, { recursive: true })
  }
}

describe("codegenModule", () => {
  beforeEach(cleanup)
  afterEach(cleanup)

  it("generateProject writes edem-manifests/ first, then generates code", async () => {
    const edem = createEdem([codegenModule])
    const manifests = loadManifests(MOCKS_DIR)

    const result = await edem.codegen.generateProject({
      project_id: "test",
      output: TEST_OUTPUT,
      manifests,
      manifests_dir: MOCKS_DIR,
    })

    expect(result.files).toBeGreaterThan(0)
    expect(result.output).toBe(TEST_OUTPUT)
    expect(existsSync(TEST_OUTPUT)).toBe(true)

    // edem-manifests/ should exist
    const manifestsDir = join(TEST_OUTPUT, "edem-manifests")
    expect(existsSync(manifestsDir)).toBe(true)
    expect(existsSync(join(manifestsDir, "routes.json"))).toBe(true)
    expect(existsSync(join(manifestsDir, "data.json"))).toBe(true)
    expect(existsSync(join(manifestsDir, "flows.json"))).toBe(true)

    // Generated files should exist
    const files = readdirSync(TEST_OUTPUT, { recursive: true })
    expect(files.length).toBeGreaterThan(3)
  }, 30_000)
})
