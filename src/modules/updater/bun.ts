import { Updater } from "electrobun/bun"
import type { EventoBun } from "@/bun/evento"
import type { UpdaterEventMap } from "./events"

const CHECK_INTERVAL_MS = 15 * 60 * 1000 // 15 minutes

export function initUpdater(evento: EventoBun) {
  function sendStatus(payload: UpdaterEventMap["app:updateStatus"]) {
    evento.emitEvent("app:updateStatus", payload, "bun")
  }

  async function checkForUpdate() {
    try {
      sendStatus({ status: "checking" })
      const result = await Updater.checkForUpdate()
      const currentVersion = await Updater.localInfo.version()
      const currentHash = await Updater.localInfo.hash()

      const isActuallyAvailable =
        result.updateAvailable && result.version !== currentVersion && result.hash !== currentHash

      if (result.error) {
        sendStatus({ status: "error", error: result.error })
        evento.emitEvent("app:clearDismissedUpdate", "bun")
      } else if (isActuallyAvailable) {
        sendStatus({
          status: "available",
          currentVersion,
          latestVersion: result.version,
        })
      } else {
        sendStatus({ status: "latest", currentVersion })
        evento.emitEvent("app:clearDismissedUpdate", "bun")
      }
    } catch (err) {
      console.error("[updater] checkUpdate error:", err)
      sendStatus({
        status: "error",
        error: (err as Error).message || String(err),
      })
      evento.emitEvent("app:clearDismissedUpdate", "bun")
    }
  }

  evento.on("app:checkUpdate", checkForUpdate)

  evento.on("app:startUpdate", async () => {
    try {
      sendStatus({ status: "downloading" })
      await Updater.downloadUpdate()
      sendStatus({ status: "applying" })
      await Updater.applyUpdate()
    } catch (err) {
      console.error("[updater] update failed:", err)
      sendStatus({
        status: "error",
        error: (err as Error).message || String(err),
      })
    }
  })

  // Check immediately on startup
  checkForUpdate()

  // Periodic background check every 15 minutes
  setInterval(checkForUpdate, CHECK_INTERVAL_MS)
}
