import { Updater } from "electrobun/bun"
import type { EventoBun } from "@/bun/evento"
import type { dataModule } from "@exodus/edem-data"
import type { InferModuleAPI } from "@exodus/edem-core"

type EdemData = InferModuleAPI<typeof dataModule>

const CHECK_INTERVAL_MS = 15 * 60 * 1000 // 15 minutes
const COLLECTION_ID = "updater_status"

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

export async function initUpdater(evento: EventoBun, edemData: EdemData) {
  await ensureStatusItem(edemData)

  async function checkForUpdate() {
    try {
      await sendStatus(edemData, { status: "checking" })
      const result = await Updater.checkForUpdate()
      const currentVersion = await Updater.localInfo.version()
      const currentHash = await Updater.localInfo.hash()

      const isActuallyAvailable =
        result.updateAvailable && result.version !== currentVersion && result.hash !== currentHash

      if (result.error) {
        await sendStatus(edemData, { status: "error", error: result.error })
      } else if (isActuallyAvailable) {
        await sendStatus(edemData, {
          status: "available",
          current_version: currentVersion,
          latest_version: result.version,
        })
      } else {
        await sendStatus(edemData, { status: "latest", current_version: currentVersion })
      }
    } catch (err) {
      console.error("[updater] checkUpdate error:", err)
      await sendStatus(edemData, {
        status: "error",
        error: (err as Error).message || String(err),
      })
    }
  }

  evento.on("updater:check-update", checkForUpdate)

  evento.on("updater:start-update", async () => {
    try {
      await sendStatus(edemData, { status: "downloading" })
      await Updater.downloadUpdate()
      await sendStatus(edemData, { status: "applying" })
      await Updater.applyUpdate()
    } catch (err) {
      console.error("[updater] update failed:", err)
      await sendStatus(edemData, {
        status: "error",
        error: (err as Error).message || String(err),
      })
    }
  })

  checkForUpdate()
  setInterval(checkForUpdate, CHECK_INTERVAL_MS)
}
