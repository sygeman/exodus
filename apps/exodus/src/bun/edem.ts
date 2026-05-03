import { Utils } from "electrobun/bun"
import { createEdem } from "@exodus/edem-core"
import { dataModule } from "@exodus/edem-data"

export const modules = [dataModule]
export const edem = createEdem(modules, { appData: Utils.paths.userData })
