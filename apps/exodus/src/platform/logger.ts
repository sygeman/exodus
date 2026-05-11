import { edem } from "@/edem"
import { patchConsole } from "./logger-shared"

let patched = false

export function initLogs() {
  if (patched) return
  patched = true
  patchConsole((entry) => {
    edem.data.createItem({ collection_id: "logs", data: entry }).catch(() => {})
  })
}
