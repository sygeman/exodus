/**
 * Edem Platform — Runtime assembly.
 *
 * Provides:
 * - createPlatform(): assembles all edem modules into a ready-to-use Edem instance
 *
 * Platform-agnostic. No Electrobun-specific code.
 */

import { createEdem } from "@exodus/edem-core"
import { dataModule } from "@exodus/edem-data"
import { flowsModule } from "@exodus/edem-flows"
import { uiModule } from "@exodus/edem-ui"
import { runnersModule } from "@exodus/edem-runners"
import { mcpModule } from "@exodus/edem-mcp"

export function createPlatform(config?: { appData?: string }) {
  return createEdem([dataModule, flowsModule, uiModule, runnersModule, mcpModule], config)
}
