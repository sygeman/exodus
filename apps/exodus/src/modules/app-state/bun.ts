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

const MIN_WINDOW_WIDTH = 400
const MIN_WINDOW_HEIGHT = 300

const COLLECTION_ID = "app_state"

let stateItemId: string | null = null

async function ensureStateItem(data: EdemData): Promise<string> {
  if (stateItemId) return stateItemId
  const { items } = await data.queryItems({ collection_id: COLLECTION_ID })
  if (items.length > 0) {
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

async function updateState(data: EdemData, patch: Record<string, unknown>) {
  const id = await ensureStateItem(data)
  await data.updateItem({ item_id: id, data: patch })
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
  const id = await ensureStateItem(data)
  const { items } = await data.queryItems({ collection_id: COLLECTION_ID })
  const item = items[0]
  const patch: Record<string, unknown> = {}

  if (!item.data.locale) {
    patch.locale = getSystemLocale()
  }
  if (!item.data.theme) {
    patch.theme = getSystemTheme()
  }

  if (Object.keys(patch).length > 0) {
    await data.updateItem({ item_id: id, data: patch })
  }
}

export function initAppState(
  edemData: EdemData,
  win: BrowserWindow,
  emit?: (name: string, payload: Record<string, unknown>) => void,
) {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  function debouncedSaveWindowFrame(frame: WindowFrame) {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
    debounceTimer = setTimeout(() => {
      if (frame.width < MIN_WINDOW_WIDTH || frame.height < MIN_WINDOW_HEIGHT) return
      updateState(edemData, { window_frame: frame }).catch(() => {})
      emit?.("window:frame_changed", { frame })
    }, 300)
  }

  win.on("resize", (event: unknown) => {
    const e = event as { data?: { x: number; y: number; width: number; height: number } }
    if (e.data) {
      debouncedSaveWindowFrame(e.data)
    }
  })

  win.on("move", () => {
    const currentFrame = win.getFrame()
    debouncedSaveWindowFrame(currentFrame)
  })

  win.on("close", () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
    const currentFrame = win.getFrame()
    updateState(edemData, {
      window_frame: currentFrame,
      window_maximized: win.isMaximized(),
    }).catch(() => {})
    emit?.("window:frame_changed", { frame: currentFrame })
  })
}
