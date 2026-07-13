import { createEdemProxy, type InferModuleAPI } from "@exodus/edem-core"
import type { dataModule } from "@exodus/edem-data"
import type { flowsModule } from "@exodus/edem-flows"
import type { electrobunModule } from "@exodus/edem-electrobun/module"
import type { netModule } from "@exodus/edem-net"
import type { ttsModule } from "@exodus/edem-tts"
import type { opencodeModule } from "@exodus/edem-opencode"
import { edemBridge } from "@/edem-bridge"

type EdemAPI = {
  data: InferModuleAPI<typeof dataModule>
  flows: InferModuleAPI<typeof flowsModule>
  electrobun: InferModuleAPI<typeof electrobunModule>
  net: InferModuleAPI<typeof netModule>
  tts: InferModuleAPI<typeof ttsModule>
  opencode: InferModuleAPI<typeof opencodeModule>
}

export const edem = createEdemProxy<EdemAPI>(edemBridge.workerFactory)
