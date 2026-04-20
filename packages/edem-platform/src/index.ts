/**
 * Edem Platform — Runtime assembly.
 *
 * Provides:
 * - createPlatform(): assembles all edem modules into a ready-to-use Core
 *
 * Platform-agnostic. No Electrobun-specific code.
 */

import { Core } from "@exodus/edem-core"
import { createDataModule } from "@exodus/edem-data"
import { createFlowsModule } from "@exodus/edem-flows"
import { createMcpModule } from "@exodus/edem-mcp"
import { createRunnersModule } from "@exodus/edem-runners"
import { createUiModule } from "@exodus/edem-ui"

export async function createPlatform() {
  const core = new Core()

  core.register(createDataModule())
  core.register(createFlowsModule())
  core.register(createUiModule())
  core.register(createRunnersModule())
  core.register(createMcpModule())

  await core.init()

  return {
    core,
    evento: core.getEvento(),
  }
}
