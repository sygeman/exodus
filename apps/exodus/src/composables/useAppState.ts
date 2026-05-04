import { ref } from "vue"
import type { Router } from "vue-router"
import { edem } from "@/edem"

const COLLECTION_ID = "app_state"

export function useAppState(router: Router) {
  const systemLocale = ref<string | null>(null)
  const systemTheme = ref<"dark" | "light" | null>(null)
  let savedHash: string | null = null
  let restoreReceived = false
  let isRouterReady = false

  function restore(hash: string | null) {
    if (hash && hash !== "#/" && hash !== "#") {
      const path = hash.startsWith("#") ? hash.slice(1) : hash
      const [pathPart, queryString] = path.split("?")
      const query = queryString ? Object.fromEntries(new URLSearchParams(queryString)) : {}
      router.replace({ path: pathPart, query }).catch(() => {
        // ignore navigation errors
      })
    }
  }

  async function startWatching() {
    try {
      const { items } = await edem.data.queryItems({ collection_id: COLLECTION_ID })
      if (items.length > 0) {
        const item = items[0]
        savedHash = item.data.last_route?.hash ?? null
        systemLocale.value = (item.data.locale as string) ?? null
        systemTheme.value = (item.data.theme as "dark" | "light") ?? null
        restoreReceived = true
        if (isRouterReady) {
          restore(savedHash)
        }
      }
    } catch {
      // ignore
    }

    edem.data.itemUpdated(async ({ event: item }) => {
      if (item.collection_id !== COLLECTION_ID) return
      systemLocale.value = (item.data.locale as string) ?? null
      systemTheme.value = (item.data.theme as "dark" | "light") ?? null
    })

    router.isReady().then(() => {
      isRouterReady = true
      if (restoreReceived) {
        restore(savedHash)
      }
    })

    router.afterEach(() => {
      edem.data
        .queryItems({ collection_id: COLLECTION_ID })
        .then(({ items }) => {
          if (items.length > 0) {
            edem.data.updateItem({
              item_id: items[0].id,
              data: { last_route: { hash: window.location.hash } },
            })
          }
        })
        .catch(() => {})
    })
  }

  return {
    restore,
    startWatching,
    systemLocale,
    systemTheme,
  }
}
