import { Utils } from "electrobun/bun"
import { createEdem } from "@exodus/edem-core"
import { dataModule } from "@exodus/edem-data"
import { flowsModule } from "@exodus/edem-flows"
import { electrobunModule } from "@exodus/edem-electrobun/module"
import { updaterModule } from "@/modules/updater/edem"

export const modules = [dataModule, flowsModule, updaterModule, electrobunModule]
export const edem = createEdem(modules, { appData: Utils.paths.userData })
