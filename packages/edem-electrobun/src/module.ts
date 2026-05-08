import { createEdemModule, type InferModuleAPI } from "@exodus/edem-core"
import type { dataModule } from "@exodus/edem-data"
import { z } from "zod"

type EdemData = InferModuleAPI<typeof dataModule>

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
let dataRef: EdemData | null = null
let stateItemId: string | null = null

const COLLECTION_ID = "app_state"

export function setElectrobunDeps(d: ElectrobunDeps): void {
  deps = d
}

async function ensureStateItem(data: EdemData): Promise<string> {
  if (stateItemId) return stateItemId
  const { items } = await data.queryItems({ collection_id: COLLECTION_ID })
  if (items.length > 0 && items[0].id) {
    stateItemId = items[0].id
    return stateItemId
  }
  const { id } = await data.createItem({
    collection_id: COLLECTION_ID,
    data: {
      window_frame: null,
      window_maximized: false,
    },
  })
  stateItemId = id
  return id
}

export const electrobunModule = createEdemModule(
  "electrobun",
  (module) =>
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
      })
      .mutation("saveWindowFrame", {
        input: z.object({
          frame: z.object({
            x: z.number(),
            y: z.number(),
            width: z.number(),
            height: z.number(),
          }),
          maximized: z.boolean().optional(),
        }),
        output: z.object({ status: z.string() }),
        resolve: async ({ input }) => {
          if (!dataRef) return { status: "error" }
          const id = await ensureStateItem(dataRef)
          const patch: Record<string, unknown> = { window_frame: input.frame }
          if (input.maximized !== undefined) patch.window_maximized = input.maximized
          await dataRef.updateItem({ item_id: id, data: patch })
          return { status: "ok" }
        },
      })
      .mutation("saveRoute", {
        input: z.object({
          hash: z.string().optional(),
        }),
        output: z.object({ status: z.string() }),
        resolve: async ({ input }) => {
          if (!dataRef) return { status: "error" }
          if (!input.hash) return { status: "skipped" }
          const id = await ensureStateItem(dataRef)
          await dataRef.updateItem({ item_id: id, data: { last_route: { hash: input.hash } } })
          return { status: "ok" }
        },
      })
      .mutation("saveSetting", {
        input: z.object({
          key: z.string(),
          value: z.unknown(),
        }),
        output: z.object({ status: z.string() }),
        resolve: async ({ input }) => {
          if (!dataRef) return { status: "error" }
          const ALLOWED_KEYS = new Set(["theme", "locale"])
          if (!input.key || !ALLOWED_KEYS.has(input.key)) return { status: "skipped" }
          const id = await ensureStateItem(dataRef)
          await dataRef.updateItem({ item_id: id, data: { [input.key]: input.value } })
          return { status: "ok" }
        },
      }),
  (edem) => {
    const modules = edem as Record<string, Record<string, unknown>>
    dataRef = modules.data as unknown as EdemData
  },
)

export default electrobunModule
