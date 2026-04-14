import type { Router } from "vue-router"
import { evento } from "@/mainview/evento"

export function useSavedRoute(router: Router) {
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

  function startWatching() {
    evento.on("app:restoreRoute", (ctx) => {
      savedHash = ctx.payload.hash
      restoreReceived = true
      if (isRouterReady) {
        restore(savedHash)
      }
    })

    router.isReady().then(() => {
      isRouterReady = true
      if (restoreReceived) {
        restore(savedHash)
      }
    })

    router.afterEach(() => {
      evento.emitEvent("app:routeChanged", { hash: window.location.hash }, "webview")
    })

    evento.emitEvent("app:requestRoute", "webview")
  }

  return {
    restore,
    startWatching,
  }
}
