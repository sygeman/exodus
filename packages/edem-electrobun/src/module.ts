import { createEdemModule } from "@exodus/edem-core"
import { z } from "zod"

type UpdaterAPI = {
  checkForUpdate: () => Promise<{
    updateAvailable: boolean
    version: string
    hash: string
    error?: string
  }>
  localInfo: {
    version: () => Promise<string>
    hash: () => Promise<string>
  }
  downloadUpdate: () => Promise<void>
  applyUpdate: () => Promise<void>
}

export interface ElectrobunDeps {
  Updater?: UpdaterAPI
}

let deps: ElectrobunDeps = {}

export function setElectrobunDeps(d: ElectrobunDeps): void {
  deps = d
}

export const electrobunModule = createEdemModule("electrobun", (module) =>
  module
    .mutation("checkUpdate", {
      input: z.object({}),
      output: z.object({
        available: z.boolean(),
        current_version: z.string().optional(),
        latest_version: z.string().optional(),
        error: z.string().nullable().optional(),
      }),
      resolve: async () => {
        if (!deps.Updater) {
          return { available: false, error: "Updater not available" }
        }

        try {
          const result = await deps.Updater.checkForUpdate()
          const currentVersion = await deps.Updater.localInfo.version()
          const currentHash = await deps.Updater.localInfo.hash()

          const isAvailable =
            result.updateAvailable &&
            result.version !== currentVersion &&
            result.hash !== currentHash

          if (result.error) {
            return { available: false, error: result.error }
          }

          if (isAvailable) {
            return {
              available: true,
              current_version: currentVersion,
              latest_version: result.version,
            }
          }

          return { available: false, current_version: currentVersion }
        } catch (err) {
          return { available: false, error: (err as Error).message || String(err) }
        }
      },
    })
    .mutation("downloadAndApplyUpdate", {
      input: z.object({}),
      output: z.object({ success: z.boolean(), error: z.string().nullable().optional() }),
      resolve: async () => {
        if (!deps.Updater) {
          return { success: false, error: "Updater not available" }
        }

        try {
          await deps.Updater.downloadUpdate()
          await deps.Updater.applyUpdate()
          return { success: true }
        } catch (err) {
          return { success: false, error: (err as Error).message || String(err) }
        }
      },
    }),
)

export default electrobunModule
