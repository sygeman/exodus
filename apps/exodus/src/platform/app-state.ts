import { edem } from "@/bun/edem"
import { getSystemLocale, getSystemTheme } from "@exodus/edem-electrobun/system"

interface WindowFrame {
  x: number
  y: number
  width: number
  height: number
}

const COLLECTION_ID = "app_state"

const MIN_WINDOW_WIDTH = 400
const MIN_WINDOW_HEIGHT = 300

export async function persistWindowFrame(frame: WindowFrame, maximized: boolean): Promise<void> {
  if (frame.width < MIN_WINDOW_WIDTH || frame.height < MIN_WINDOW_HEIGHT) return
  await edem.data.updateSingleton({
    collection_id: COLLECTION_ID,
    data: { window_frame: frame, window_maximized: maximized },
  })
}

export async function initStateDefaults() {
  const { item } = await edem.data.getSingleton({ collection_id: COLLECTION_ID })
  if (!item) return
  const patch: Record<string, unknown> = {}

  if (!item.data.locale) {
    patch.locale = getSystemLocale()
  }
  if (!item.data.theme) {
    patch.theme = getSystemTheme()
  }

  if (Object.keys(patch).length > 0) {
    await edem.data.updateSingleton({ collection_id: COLLECTION_ID, data: patch })
  }
}
