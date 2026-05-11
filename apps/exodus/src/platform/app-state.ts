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
