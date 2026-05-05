import { createEdemProxy, type InferModuleAPI } from "@exodus/edem-core"
import type { dataModule } from "@exodus/edem-data"
import type { flowsModule } from "@exodus/edem-flows"
import type { updaterModule } from "@/modules/updater/edem"
import { edemBridge } from "@/edem-bridge"

type EdemAPI = {
  data: InferModuleAPI<typeof dataModule>
  flows: InferModuleAPI<typeof flowsModule>
  updater: InferModuleAPI<typeof updaterModule>
}

export const edem = createEdemProxy<EdemAPI>(edemBridge.workerFactory)
