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
  data?: EdemData
}

let deps: ElectrobunDeps = {}

export function setElectrobunDeps(d: ElectrobunDeps): void {
  deps = d
}

const COLLECTION_ID = "updater_status"

let statusItemId: string | null = null

async function ensureStatusItem(data: EdemData): Promise<string> {
  if (statusItemId) return statusItemId
  const { items } = await data.queryItems({ collection_id: COLLECTION_ID })
  if (items.length > 0 && items[0].id) {
    statusItemId = items[0].id
    return statusItemId
  }
  const { id } = await data.createItem({
    collection_id: COLLECTION_ID,
    data: { status: "idle" },
  })
  statusItemId = id
  return id
}

async function sendStatus(
  data: EdemData,
  payload: {
    status: "idle" | "checking" | "available" | "latest" | "error" | "downloading" | "applying"
    current_version?: string
    latest_version?: string
    error?: string
  },
) {
  const id = await ensureStatusItem(data)
  await data.updateItem({ item_id: id, data: payload })
}

async function checkForUpdate(data: EdemData) {
  if (!deps.Updater) return
  try {
    await sendStatus(data, { status: "checking" })
    const result = await deps.Updater.checkForUpdate()
    const currentVersion = await deps.Updater.localInfo.version()
    const currentHash = await deps.Updater.localInfo.hash()

    const isActuallyAvailable =
      result.updateAvailable && result.version !== currentVersion && result.hash !== currentHash

    if (result.error) {
      await sendStatus(data, { status: "error", error: result.error })
    } else if (isActuallyAvailable) {
      await sendStatus(data, {
        status: "available",
        current_version: currentVersion,
        latest_version: result.version,
      })
    } else {
      await sendStatus(data, { status: "latest", current_version: currentVersion })
    }
  } catch (err) {
    console.error("[updater] checkUpdate error:", err)
    await sendStatus(data, {
      status: "error",
      error: (err as Error).message || String(err),
    })
  }
}

async function startUpdate(data: EdemData) {
  if (!deps.Updater) return
  try {
    await sendStatus(data, { status: "downloading" })
    await deps.Updater.downloadUpdate()
    await sendStatus(data, { status: "applying" })
    await deps.Updater.applyUpdate()
  } catch (err) {
    console.error("[updater] update failed:", err)
    await sendStatus(data, {
      status: "error",
      error: (err as Error).message || String(err),
    })
  }
}

export const electrobunModule = createEdemModule(
  "electrobun",
  (module) =>
    module
      .mutation("checkUpdate", {
        input: z.object({}),
        output: z.object({ status: z.string() }),
        resolve: async () => {
          if (deps.data) await checkForUpdate(deps.data)
          return { status: "ok" }
        },
      })
      .mutation("startUpdate", {
        input: z.object({}),
        output: z.object({ status: z.string() }),
        resolve: async () => {
          if (deps.data) await startUpdate(deps.data)
          return { status: "ok" }
        },
      }),
  () => {
    if (deps.data) {
      ensureStatusItem(deps.data).then(() => checkForUpdate(deps.data!))
    }
  },
)

export default electrobunModule
