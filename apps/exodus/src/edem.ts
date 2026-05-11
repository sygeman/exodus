import { createEdemProxy, type InferModuleAPI } from "@exodus/edem-core"
import type { dataModule } from "@exodus/edem-data"
import type { flowsModule } from "@exodus/edem-flows"
import type { electrobunModule } from "@exodus/edem-electrobun/module"
import { edemBridge } from "@/edem-bridge"

type EdemAPI = {
  data: InferModuleAPI<typeof dataModule>
  flows: InferModuleAPI<typeof flowsModule>
  electrobun: InferModuleAPI<typeof electrobunModule>
}

export const edem = createEdemProxy<EdemAPI>(edemBridge.workerFactory)
