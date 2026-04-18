import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs"
import { join, dirname } from "path"
import { Utils, type BrowserWindow } from "electrobun/bun"
import type { EventoBun } from "@/bun/evento"

const STATE_FILE = join(Utils.paths.userData, "app-state.json")

interface WindowFrame {
  x: number
  y: number
  width: number
  height: number
}

interface AppState {
  lastRoute?: { hash: string }
  dismissedUpdate?: { version: string }
  locale?: string
  theme?: "dark" | "light"
  windowFrame?: WindowFrame
  windowMaximized?: boolean
}

export function readState(): AppState {
  try {
    if (!existsSync(STATE_FILE)) return {}
    return JSON.parse(readFileSync(STATE_FILE, "utf-8")) as AppState
  } catch {
    return {}
  }
}

function saveWindowFrame(frame: WindowFrame) {
  const state = readState()
  state.windowFrame = frame
  writeState(state)
}

function saveWindowMaximized(maximized: boolean) {
  const state = readState()
  state.windowMaximized = maximized
  writeState(state)
}

function writeState(state: AppState) {
  try {
    mkdirSync(dirname(STATE_FILE), { recursive: true })
    writeFileSync(STATE_FILE, JSON.stringify(state))
  } catch {
    // ignore
  }
}

function getSystemLocale(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale
  } catch {
    return "en-US"
  }
}

function getSystemTheme(): "dark" | "light" {
  if (process.platform === "darwin") {
    try {
      const { execSync } = require("child_process")
      const style = execSync("defaults read -g AppleInterfaceStyle", { encoding: "utf-8" }).trim()
      return style === "Dark" ? "dark" : "light"
    } catch {
      return "light"
    }
  }

  if (process.platform === "win32") {
    try {
      const { execSync } = require("child_process")
      const result = execSync(
        'reg query "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize" /v AppsUseLightTheme',
        { encoding: "utf-8" },
      )
      return result.includes("0x0") ? "dark" : "light"
    } catch {
      return "light"
    }
  }

  if (process.platform === "linux") {
    try {
      const { execSync } = require("child_process")
      const theme = execSync("gsettings get org.gnome.desktop.interface gtk-theme", {
        encoding: "utf-8",
      }).trim()
      return theme.toLowerCase().includes("dark") ? "dark" : "light"
    } catch {
      return "light"
    }
  }

  return "light"
}

export function initAppState(
  evento: EventoBun,
  win: BrowserWindow,
  sender: (name: string, payload: unknown) => void,
) {
  evento.on("app-state:route-changed", (ctx) => {
    const state = readState()
    state.lastRoute = { hash: ctx.payload.hash }
    writeState(state)
  })

  evento.on("app-state:request-state", () => {
    const state = readState()
    const systemLocale = getSystemLocale()
    const systemTheme = getSystemTheme()
    sender("app-state:restore-state", {
      hash: state.lastRoute?.hash ?? null,
      dismissed_update_version: state.dismissedUpdate?.version ?? null,
      locale: state.locale ?? systemLocale,
      theme: state.theme ?? systemTheme,
      window_frame: state.windowFrame ?? null,
      window_maximized: state.windowMaximized ?? null,
    })
  })

  evento.on("app-state:save-settings", (ctx) => {
    const state = readState()
    if (ctx.payload.locale !== undefined) {
      state.locale = ctx.payload.locale
    }
    if (ctx.payload.theme !== undefined) {
      state.theme = ctx.payload.theme
    }
    writeState(state)
  })

  evento.on("app-state:dismiss-update", (ctx) => {
    const state = readState()
    state.dismissedUpdate = { version: ctx.payload.version }
    writeState(state)
  })

  evento.on("app-state:clear-dismissed-update", () => {
    const state = readState()
    delete state.dismissedUpdate
    writeState(state)
  })

  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  function debouncedSaveWindowFrame(data: WindowFrame) {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
    debounceTimer = setTimeout(() => {
      saveWindowFrame(data)
    }, 300)
  }

  win.on("resize", (event: unknown) => {
    const e = event as { data?: { x: number; y: number; width: number; height: number } }
    if (e.data) {
      debouncedSaveWindowFrame(e.data)
    }
  })

  win.on("move", (event: unknown) => {
    const e = event as { data?: { x: number; y: number } }
    if (e.data) {
      const currentFrame = win.getFrame()
      debouncedSaveWindowFrame(currentFrame)
    }
  })

  win.on("close", () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
    const currentFrame = win.getFrame()
    saveWindowFrame(currentFrame)
    saveWindowMaximized(win.isMaximized())
  })
}
