import { createEdemProxy, type InferModuleAPI } from "@exodus/edem-core"
import type { dataModule } from "@exodus/edem-data"
import { edemBridge } from "@/evento"

type EdemAPI = { data: InferModuleAPI<typeof dataModule> }

export const edem = createEdemProxy<EdemAPI>(edemBridge.workerFactory)
