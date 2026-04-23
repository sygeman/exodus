/**
 * Edem Platform — Runtime assembly.
 *
 * Provides:
 * - createPlatform(): assembles all edem modules into a ready-to-use Edem instance
 *
 * Platform-agnostic. No Electrobun-specific code.
 */

import { Edem } from "@exodus/edem-core"
import { createDataModule } from "@exodus/edem-data"
import { createFlowsModule } from "@exodus/edem-flows"
import { createMcpModule } from "@exodus/edem-mcp"
import { createRunnersModule } from "@exodus/edem-runners"
import { createUiModule } from "@exodus/edem-ui"

export function createPlatform() {
  const edem = new Edem("bun")

  edem
    .register(createDataModule)
    .register(createFlowsModule)
    .register(createUiModule)
    .register(createRunnersModule)
    .register(createMcpModule)

  return edem
}
