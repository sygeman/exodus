import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs"
import { join, dirname } from "path"
import { Utils } from "electrobun/bun"
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

export function initAppState(evento: EventoBun, sender: (name: string, payload: unknown) => void) {
  evento.on("app:routeChanged", (ctx) => {
    saveRoute(ctx.payload.hash)
  })

  evento.on("app:requestRoute", () => {
    sender("app:restoreRoute", { hash: getSavedRoute() })
  })
}
