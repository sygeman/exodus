import type { flowsModule } from "@exodus/edem-flows"
import type { InferModuleAPI } from "@exodus/edem-core"
import { SYSTEM_FLOWS_MANIFEST } from "./flows-manifest"

type EdemFlows = InferModuleAPI<typeof flowsModule>

export async function ensureFlows(flows: EdemFlows): Promise<void> {
  const result = await flows.applyManifest({ manifest: SYSTEM_FLOWS_MANIFEST })

  if (result.created.length > 0) {
    console.log(`[flows] Created ${result.created.length} system flows:`, result.created)
  }
  if (result.updated.length > 0) {
    console.log(`[flows] Updated ${result.updated.length} system flows:`, result.updated)
  }
}
