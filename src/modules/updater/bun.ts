import { Updater } from "electrobun/bun"
import type { EventoBun } from "@/bun/evento"
import type { UpdaterEventMap } from "./events"

export function initUpdater(evento: EventoBun) {
  function sendStatus(payload: UpdaterEventMap["app:updateStatus"]) {
    evento.emitEvent("app:updateStatus", payload, "bun")
  }

  evento.on("app:checkUpdate", async () => {
    try {
      sendStatus({ status: "checking" })
      const result = await Updater.checkForUpdate()
      if (result.error) {
        sendStatus({ status: "error", error: result.error })
      } else if (result.updateAvailable) {
        sendStatus({
          status: "available",
          currentVersion: result.version,
          latestVersion: result.version,
        })
      } else {
        sendStatus({ status: "latest", currentVersion: result.version })
      }
    } catch (err) {
      console.error("[updater] checkUpdate error:", err)
      sendStatus({
        status: "error",
        error: (err as Error).message || String(err),
      })
    }
  })

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
}
