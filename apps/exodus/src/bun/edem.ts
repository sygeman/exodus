import { Utils } from "electrobun/bun"
import { createEdem } from "@exodus/edem-core"
import { dataModule } from "@exodus/edem-data"
import { flowsModule } from "@exodus/edem-flows"
import { electrobunModule } from "@exodus/edem-electrobun/module"
import { netModule } from "@exodus/edem-net"
import { ttsModule } from "@exodus/edem-tts"
import { opencodeModule } from "@exodus/edem-opencode"

export const modules = [
  dataModule,
  flowsModule,
  electrobunModule,
  netModule,
  ttsModule,
  opencodeModule,
]
export const edem = createEdem(modules, { appData: Utils.paths.userData })
