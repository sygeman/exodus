import { Utils } from "electrobun/bun"
import { createEdem } from "@exodus/edem-core"
import { dataModule } from "@exodus/edem-data"
import { flowsModule } from "@exodus/edem-flows"
import { electrobunModule } from "@exodus/edem-electrobun/module"

export const modules = [dataModule, flowsModule, electrobunModule]
export const edem = createEdem(modules, { appData: Utils.paths.userData })
