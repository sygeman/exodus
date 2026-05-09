import type { Stage, StageInput, StageOutput, OutputFile } from "../ir"

// ── Flows Stage ───────────────────────────────────────────────────────────────
// Generates flows manifest and bootstrap.

export const flowsStage: Stage = {
  name: "flows",

  async handle({ ir }: StageInput): Promise<StageOutput> {
    const files: OutputFile[] = []

    if (ir.flows.length === 0) {
      return { files, deps: [] }
    }

    files.push({
      path: "src/flows-manifest.ts",
      content: generateFlowsManifest(),
    })

    files.push({
      path: "src/flows-bootstrap.ts",
      content: generateFlowsBootstrap(),
    })

    return { files, deps: ["@exodus/edem-flows"] }
  },
}

// ── Generators ────────────────────────────────────────────────────────────────

function generateFlowsManifest(): string {
  return `import type { FlowsManifest } from "@exodus/edem-flows"
import manifest from "../edem-manifests/flows.json"

export const SYSTEM_FLOWS_MANIFEST: FlowsManifest = manifest as FlowsManifest
`
}

function generateFlowsBootstrap(): string {
  return `import type { flowsModule } from "@exodus/edem-flows"
import type { InferModuleAPI } from "@exodus/edem-core"
import { SYSTEM_FLOWS_MANIFEST } from "./flows-manifest"

type EdemFlows = InferModuleAPI<typeof flowsModule>

export async function ensureFlows(flows: EdemFlows): Promise<void> {
  const result = await flows.applyManifest({ manifest: SYSTEM_FLOWS_MANIFEST })

  if (result.created.length > 0) {
    console.log("[flows] Created", result.created.length, "system flows")
  }
  if (result.updated.length > 0) {
    console.log("[flows] Updated", result.updated.length, "system flows")
  }
}
`
}
