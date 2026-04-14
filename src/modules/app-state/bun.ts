import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs"
import { join, dirname } from "path"
import { Utils, type BrowserView } from "electrobun/bun"
import type { EventoBun } from "@/bun/evento"

const ROUTE_FILE = join(Utils.paths.userData, "last-route.json")

function saveRoute(hash: string) {
  try {
    mkdirSync(dirname(ROUTE_FILE), { recursive: true })
    writeFileSync(ROUTE_FILE, JSON.stringify({ hash }))
  } catch {
    // ignore
  }
}

function getSavedRoute(): string | null {
  try {
    if (!existsSync(ROUTE_FILE)) return null
    const data = JSON.parse(readFileSync(ROUTE_FILE, "utf-8"))
    return data.hash || null
  } catch {
    return null
  }
}

export function initAppState(
  evento: EventoBun,
  webview: BrowserView,
  sender: (name: string, payload: unknown) => void,
) {
  evento.on("app:routeChanged", (ctx) => {
    saveRoute(ctx.payload.hash)
  })

  const savedHash = getSavedRoute()
  let sent = false

  webview.on("dom-ready", () => {
    if (sent) return
    sent = true
    sender("app:restoreRoute", { hash: savedHash })
  })
}
