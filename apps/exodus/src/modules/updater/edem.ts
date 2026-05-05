import { createEdemModule, type InferModuleAPI } from "@exodus/edem-core"
import type { dataModule } from "@exodus/edem-data"
import { z } from "zod"
import { Updater } from "electrobun/bun"

type EdemData = InferModuleAPI<typeof dataModule>

const CHECK_INTERVAL_MS = 15 * 60 * 1000
const COLLECTION_ID = "updater_status"

let dataRef: EdemData | null = null
let statusItemId: string | null = null

async function ensureStatusItem(data: EdemData): Promise<string> {
  if (statusItemId) return statusItemId
  const { items } = await data.queryItems({ collection_id: COLLECTION_ID })
  if (items.length > 0) {
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

async function checkForUpdate() {
  if (!dataRef) return
  try {
    await sendStatus(dataRef, { status: "checking" })
    const result = await Updater.checkForUpdate()
    const currentVersion = await Updater.localInfo.version()
    const currentHash = await Updater.localInfo.hash()

    const isActuallyAvailable =
      result.updateAvailable && result.version !== currentVersion && result.hash !== currentHash

    if (result.error) {
      await sendStatus(dataRef, { status: "error", error: result.error })
    } else if (isActuallyAvailable) {
      await sendStatus(dataRef, {
        status: "available",
        current_version: currentVersion,
        latest_version: result.version,
      })
    } else {
      await sendStatus(dataRef, { status: "latest", current_version: currentVersion })
    }
  } catch (err) {
    console.error("[updater] checkUpdate error:", err)
    await sendStatus(dataRef, {
      status: "error",
      error: (err as Error).message || String(err),
    })
  }
}

async function startUpdate() {
  if (!dataRef) return
  try {
    await sendStatus(dataRef, { status: "downloading" })
    await Updater.downloadUpdate()
    await sendStatus(dataRef, { status: "applying" })
    await Updater.applyUpdate()
  } catch (err) {
    console.error("[updater] update failed:", err)
    await sendStatus(dataRef, {
      status: "error",
      error: (err as Error).message || String(err),
    })
  }
}

export const updaterModule = createEdemModule(
  "updater",
  (module) =>
    module
      .mutation("checkUpdate", {
        input: z.object({}),
        output: z.object({ status: z.string() }),
        resolve: async () => {
          await checkForUpdate()
          return { status: "ok" }
        },
      })
      .mutation("startUpdate", {
        input: z.object({}),
        output: z.object({ status: z.string() }),
        resolve: async () => {
          await startUpdate()
          return { status: "ok" }
        },
      }),
  (edem) => {
    const { data } = edem as { data: EdemData }
    dataRef = data
    ensureStatusItem(data).then(() => {
      checkForUpdate()
      setInterval(checkForUpdate, CHECK_INTERVAL_MS)
    })
  },
)
