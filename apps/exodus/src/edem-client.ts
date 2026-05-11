import { EdemClient } from "@exodus/edem-vue"
import { edem } from "./edem"
import type { dataManifest } from "./data-manifest"

export const client = new EdemClient<typeof dataManifest>(edem.data)
