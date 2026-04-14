import type { Router } from "vue-router"

const LS_ROUTE_KEY = "exodus:last-route"

export function useSavedRoute(router: Router) {
  function save(hash: string) {
    try {
      localStorage.setItem(LS_ROUTE_KEY, hash)
    } catch {
      // ignore storage errors
    }
  }

  function restore() {
    const savedHash = (() => {
      try {
        return localStorage.getItem(LS_ROUTE_KEY)
      } catch {
        return null
      }
    })()

    if (savedHash && savedHash !== "#/" && savedHash !== "#") {
      const hash = savedHash.startsWith("#") ? savedHash.slice(1) : savedHash
      const [pathPart, queryString] = hash.split("?")
      const query = queryString ? Object.fromEntries(new URLSearchParams(queryString)) : {}
      router.replace({ path: pathPart, query })
    }
  }

  function startWatching() {
    router.afterEach(() => {
      save(window.location.hash)
    })

    router.isReady().then(() => {
      restore()
    })
  }

  return {
    save,
    restore,
    startWatching,
  }
}
