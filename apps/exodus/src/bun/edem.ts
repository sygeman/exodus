import { Utils } from "electrobun/bun"
import { createEdem } from "@exodus/edem-core"
import { dataModule } from "@exodus/edem-data"
import { updaterModule } from "@/modules/updater/edem"

export const modules = [dataModule, updaterModule]
export const edem = createEdem(modules, { appData: Utils.paths.userData })
