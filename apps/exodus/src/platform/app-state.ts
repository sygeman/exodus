import type { dataModule } from "@exodus/edem-data"
import type { InferModuleAPI } from "@exodus/edem-core"
import { getSystemLocale, getSystemTheme } from "@exodus/edem-electrobun/system"

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

export async function persistWindowFrame(
  data: EdemData,
  frame: WindowFrame,
  maximized?: boolean,
): Promise<void> {
  if (frame.width < MIN_WINDOW_WIDTH || frame.height < MIN_WINDOW_HEIGHT) return
  const patch: Record<string, unknown> = { window_frame: frame }
  if (maximized !== undefined) patch.window_maximized = maximized
  await data.updateSingleton({ collection_id: COLLECTION_ID, data: patch })
}

export async function initStateDefaults(data: EdemData) {
  const { item } = await data.getSingleton({ collection_id: COLLECTION_ID })
  if (!item) return
  const patch: Record<string, unknown> = {}

  if (!item.data.locale) {
    patch.locale = getSystemLocale()
  }
  if (!item.data.theme) {
    patch.theme = getSystemTheme()
  }

  if (Object.keys(patch).length > 0) {
    await data.updateSingleton({ collection_id: COLLECTION_ID, data: patch })
  }
}
