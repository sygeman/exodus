import type { dataModule, Manifest } from "@exodus/edem-data"
import type { InferModuleAPI } from "@exodus/edem-core"
import manifest from "../data.json"

type EdemData = InferModuleAPI<typeof dataModule>

export const SYSTEM_MANIFEST: Manifest = manifest as Manifest

export async function ensureCollections(data: EdemData): Promise<void> {
  await data.applyManifest({ manifest: SYSTEM_MANIFEST })
}
