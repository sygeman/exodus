import { Utils } from "electrobun/bun"
import { createEdem } from "@exodus/edem-core"
import { dataModule } from "@exodus/edem-data"

export const edem = createEdem([dataModule], { appData: Utils.paths.userData })
