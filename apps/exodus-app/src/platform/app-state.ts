import type { BrowserWindow } from "electrobun/bun"
import type { dataModule } from "@exodus/edem-data"
import type { InferModuleAPI } from "@exodus/edem-core"

type EdemData = InferModuleAPI<typeof dataModule>

interface WindowFrame {
  x: number
  y: number
  width: number
  height: number
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
  const { items } = await data.queryItems({ collection_id: "app_state" })
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
  emit?: (name: string, payload: Record<string, unknown>) => void,
) {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  function debouncedEmitFrame(frame: WindowFrame) {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
    debounceTimer = setTimeout(() => {
      if (frame.width < 400 || frame.height < 300) return
      emit?.("window:frame_changed", { frame })
    }, 300)
  }

  win.on("resize", (event: unknown) => {
    const e = event as { data?: { x: number; y: number; width: number; height: number } }
    if (e.data) {
      debouncedEmitFrame(e.data)
    }
  })

  win.on("move", () => {
    const currentFrame = win.getFrame()
    debouncedEmitFrame(currentFrame)
  })

  win.on("close", () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
    const currentFrame = win.getFrame()
    emit?.("window:frame_changed", { frame: currentFrame, maximized: win.isMaximized() })
  })
}
