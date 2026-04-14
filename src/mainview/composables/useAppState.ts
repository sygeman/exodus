import { ref } from "vue"
import type { Router } from "vue-router"
import { evento } from "@/mainview/evento"

export function useAppState(router: Router) {
  const dismissedUpdateVersion = ref<string | null>(null)
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
    evento.on("app:restoreState", (ctx) => {
      savedHash = ctx.payload.hash
      dismissedUpdateVersion.value = ctx.payload.dismissedUpdateVersion
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

    evento.emitEvent("app:requestState", "webview")
  }

  return {
    restore,
    startWatching,
    dismissedUpdateVersion,
  }
}
