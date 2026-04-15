import { ref } from "vue"
import type { Router } from "vue-router"
import { evento } from "@/mainview/evento"

export function useAppState(router: Router) {
  const dismissedUpdateVersion = ref<string | null>(null)
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

  function startWatching() {
    evento.on("app-state:restore-state", (ctx) => {
      savedHash = ctx.payload.hash
      dismissedUpdateVersion.value = ctx.payload.dismissed_update_version
      systemLocale.value = ctx.payload.locale
      systemTheme.value = ctx.payload.theme
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
      evento.emitEvent("app-state:route-changed", { hash: window.location.hash }, "webview")
    })

    evento.emitEvent("app-state:request-state", "webview")
  }

  return {
    restore,
    startWatching,
    dismissedUpdateVersion,
    systemLocale,
    systemTheme,
  }
}
