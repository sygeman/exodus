import { Updater } from "electrobun/bun"
import type { EventoBun } from "@/bun/evento"
import type { UpdaterEventMap } from "./events"

const CHECK_INTERVAL_MS = 15 * 60 * 1000 // 15 minutes

export function initUpdater(evento: EventoBun) {
  function sendStatus(payload: UpdaterEventMap["updater:update-status"]) {
    evento.emitEvent("updater:update-status", payload, "bun")
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
        evento.emitEvent("app-state:clear-dismissed-update", "bun")
      } else if (isActuallyAvailable) {
        sendStatus({
          status: "available",
          current_version: currentVersion,
          latest_version: result.version,
        })
      } else {
        sendStatus({ status: "latest", current_version: currentVersion })
        evento.emitEvent("app-state:clear-dismissed-update", "bun")
      }
    } catch (err) {
      console.error("[updater] checkUpdate error:", err)
      sendStatus({
        status: "error",
        error: (err as Error).message || String(err),
      })
      evento.emitEvent("app-state:clear-dismissed-update", "bun")
    }
  }

  evento.on("updater:check-update", checkForUpdate)

  evento.on("updater:start-update", async () => {
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
