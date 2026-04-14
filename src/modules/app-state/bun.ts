import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs"
import { join, dirname } from "path"
import { Utils } from "electrobun/bun"
import type { EventoBun } from "@/bun/evento"

const STATE_FILE = join(Utils.paths.userData, "app-state.json")

interface AppState {
  lastRoute?: { hash: string }
  dismissedUpdate?: { version: string }
}

function readState(): AppState {
  try {
    if (!existsSync(STATE_FILE)) return {}
    return JSON.parse(readFileSync(STATE_FILE, "utf-8")) as AppState
  } catch {
    return {}
  }
}

function writeState(state: AppState) {
  try {
    mkdirSync(dirname(STATE_FILE), { recursive: true })
    writeFileSync(STATE_FILE, JSON.stringify(state))
  } catch {
    // ignore
  }
}

export function initAppState(evento: EventoBun, sender: (name: string, payload: unknown) => void) {
  evento.on("app:routeChanged", (ctx) => {
    const state = readState()
    state.lastRoute = { hash: ctx.payload.hash }
    writeState(state)
  })

  evento.on("app:requestState", () => {
    const state = readState()
    sender("app:restoreState", {
      hash: state.lastRoute?.hash ?? null,
      dismissedUpdateVersion: state.dismissedUpdate?.version ?? null,
    })
  })

  evento.on("app:dismissUpdate", (ctx) => {
    const state = readState()
    state.dismissedUpdate = { version: ctx.payload.version }
    writeState(state)
  })

  evento.on("app:clearDismissedUpdate", () => {
    const state = readState()
    delete state.dismissedUpdate
    writeState(state)
  })
}
