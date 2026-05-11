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

const UpdateStatusSchema = z.object({
  status: z.enum(["idle", "checking", "available", "latest", "error", "downloading", "applying"]),
  current_version: z.string().optional(),
  latest_version: z.string().optional(),
  error: z.string().optional(),
})

export const electrobunModule = createEdemModule("electrobun", (module) =>
  module
    .context(async () => ({
      updater: deps.Updater!,
    }))
    .query("getVersion", {
      input: z.object({}),
      output: z.object({ version: z.string() }),
      resolve: async ({ ctx }) => {
        const version = await ctx.updater.localInfo.version()
        return { version }
      },
    })
    .subscription("updateStatus", {
      output: UpdateStatusSchema,
    })
    .mutation("checkUpdate", {
      input: z.object({}),
      output: z.object({
        available: z.boolean(),
        current_version: z.string().optional(),
        latest_version: z.string().optional(),
        error: z.string().nullable().optional(),
      }),
      resolve: async ({ ctx, emit }) => {
        if (!ctx.updater) {
          return { available: false, error: "Updater not available" }
        }

        try {
          await emit.updateStatus({ status: "checking" })

          const result = await ctx.updater.checkForUpdate()
          const currentVersion = await ctx.updater.localInfo.version()
          const currentHash = await ctx.updater.localInfo.hash()

          const isAvailable =
            result.updateAvailable &&
            result.version !== currentVersion &&
            result.hash !== currentHash

          if (result.error) {
            await emit.updateStatus({ status: "error", error: result.error })
            return { available: false, error: result.error }
          }

          if (isAvailable) {
            await emit.updateStatus({
              status: "available",
              current_version: currentVersion,
              latest_version: result.version,
            })
            return {
              available: true,
              current_version: currentVersion,
              latest_version: result.version,
            }
          }

          await emit.updateStatus({ status: "latest", current_version: currentVersion })
          return { available: false, current_version: currentVersion }
        } catch (err) {
          const error = (err as Error).message || String(err)
          await emit.updateStatus({ status: "error", error })
          return { available: false, error }
        }
      },
    })
    .mutation("startUpdate", {
      input: z.object({}),
      output: z.object({ success: z.boolean(), error: z.string().nullable().optional() }),
      resolve: async ({ ctx, emit }) => {
        if (!ctx.updater) {
          return { success: false, error: "Updater not available" }
        }

        try {
          await emit.updateStatus({ status: "downloading" })
          await ctx.updater.downloadUpdate()
          await emit.updateStatus({ status: "applying" })
          await ctx.updater.applyUpdate()
          return { success: true }
        } catch (err) {
          const error = (err as Error).message || String(err)
          await emit.updateStatus({ status: "error", error })
          return { success: false, error }
        }
      },
    }),
)

export default electrobunModule
