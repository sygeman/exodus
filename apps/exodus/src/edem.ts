import { createEdemProxy, type InferModuleAPI } from "@exodus/edem-core"
import type { dataModule } from "@exodus/edem-data"
import type { updaterModule } from "@/modules/updater/edem"
import { edemBridge } from "@/edem-bridge"

type EdemAPI = {
  data: InferModuleAPI<typeof dataModule>
  updater: InferModuleAPI<typeof updaterModule>
}

export const edem = createEdemProxy<EdemAPI>(edemBridge.workerFactory)
