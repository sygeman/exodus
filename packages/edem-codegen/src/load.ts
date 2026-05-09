import { readFileSync, readdirSync, existsSync } from "fs"
import { join } from "path"
import type { ComponentNode, UIManifest } from "@exodus/edem-ui"
import type { Manifests } from "./parse"

// ── Manifest Loader ───────────────────────────────────────────────────────────
// Reads ui.json + components/*.json and merges into a single Manifests object.

export function loadManifests(dir: string): Manifests {
  const uiPath = join(dir, "ui.json")
  const componentsDir = join(dir, "components")

  // Load ui.json (routes only)
  const ui: UIManifest = JSON.parse(readFileSync(uiPath, "utf-8"))

  // Load components from components/*.json
  const components: Record<string, ComponentNode> = {}

  if (existsSync(componentsDir)) {
    const files = readdirSync(componentsDir).filter((f) => f.endsWith(".json"))
    for (const file of files) {
      const name = file.replace(/\.json$/, "")
      const content = JSON.parse(readFileSync(join(componentsDir, file), "utf-8"))
      components[name] = content
    }
  }

  // Also support inline components in ui.json for backward compatibility
  if (ui.components) {
    Object.assign(components, ui.components)
  }

  // Load data.json
  const dataPath = join(dir, "data.json")
  const data = JSON.parse(readFileSync(dataPath, "utf-8"))

  // Load flows.json
  const flowsPath = join(dir, "flows.json")
  const flows = JSON.parse(readFileSync(flowsPath, "utf-8"))

  // Load platform.json (optional)
  const platformPath = join(dir, "platform.json")
  const platform = existsSync(platformPath)
    ? JSON.parse(readFileSync(platformPath, "utf-8"))
    : undefined

  return { ui, components, data, flows, platform }
}
