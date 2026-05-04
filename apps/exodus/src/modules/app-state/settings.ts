import { edem } from "@/edem"

const COLLECTION_ID = "app_state"

let cachedItemId: string | null = null

export async function saveAppSettings(data: Record<string, unknown>) {
  if (!cachedItemId) {
    const { items } = await edem.data.queryItems({ collection_id: COLLECTION_ID })
    if (items.length > 0) {
      cachedItemId = items[0].id
    }
  }
  if (cachedItemId) {
    await edem.data.updateItem({ item_id: cachedItemId, data })
  }
}
