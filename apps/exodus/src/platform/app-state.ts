import { type BrowserWindow } from "electrobun/bun"
import type { dataModule } from "@exodus/edem-data"
import type { InferModuleAPI } from "@exodus/edem-core"

type EdemData = InferModuleAPI<typeof dataModule>

interface WindowFrame {
  x: number
  y: number
  width: number
  height: number
}

const COLLECTION_ID = "app_state"

const MIN_WINDOW_WIDTH = 400
const MIN_WINDOW_HEIGHT = 300

let stateItemId: string | null = null

async function ensureAppStateItem(data: EdemData): Promise<string> {
  if (stateItemId) return stateItemId
  const { items } = await data.queryItems({ collection_id: COLLECTION_ID })
  if (items.length > 0 && items[0].id) {
    stateItemId = items[0].id
    return stateItemId
  }
  const { id } = await data.createItem({
    collection_id: COLLECTION_ID,
    data: {
      window_frame: null,
      window_maximized: false,
    },
  })
  stateItemId = id
  return id
}

export async function persistWindowFrame(
  data: EdemData,
  frame: WindowFrame,
  maximized?: boolean,
): Promise<void> {
  if (frame.width < MIN_WINDOW_WIDTH || frame.height < MIN_WINDOW_HEIGHT) return
  const id = await ensureAppStateItem(data)
  const patch: Record<string, unknown> = { window_frame: frame }
  if (maximized !== undefined) patch.window_maximized = maximized
  await data.updateItem({ item_id: id, data: patch })
}

export async function persistRoute(data: EdemData, hash?: string): Promise<void> {
  if (!hash) return
  const id = await ensureAppStateItem(data)
  await data.updateItem({ item_id: id, data: { last_route: { hash } } })
}

const ALLOWED_SETTING_KEYS = new Set(["theme", "locale"])

export async function persistSetting(data: EdemData, key: string, value: unknown): Promise<void> {
  if (!key || !ALLOWED_SETTING_KEYS.has(key)) return
  const id = await ensureAppStateItem(data)
  await data.updateItem({ item_id: id, data: { [key]: value } })
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

export async function initStateDefaults(data: EdemData) {
  const { items } = await data.queryItems({ collection_id: COLLECTION_ID })
  if (items.length === 0) return
  const item = items[0]
  const patch: Record<string, unknown> = {}

  if (!item.data.locale) {
    patch.locale = getSystemLocale()
  }
  if (!item.data.theme) {
    patch.theme = getSystemTheme()
  }

  if (Object.keys(patch).length > 0) {
    await data.updateItem({ item_id: item.id, data: patch })
  }
}

export function initAppState(
  win: BrowserWindow,
  saveFrame?: (data: { frame: WindowFrame; maximized?: boolean }) => void,
) {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  function debouncedSaveFrame(frame: WindowFrame) {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
    debounceTimer = setTimeout(() => {
      saveFrame?.({ frame })
    }, 300)
  }

  win.on("resize", (event: unknown) => {
    const e = event as { data?: { x: number; y: number; width: number; height: number } }
    if (e.data) {
      debouncedSaveFrame(e.data)
    }
  })

  win.on("move", () => {
    const currentFrame = win.getFrame()
    debouncedSaveFrame(currentFrame)
  })

  win.on("close", () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
    const currentFrame = win.getFrame()
    saveFrame?.({ frame: currentFrame, maximized: win.isMaximized() })
  })
}
