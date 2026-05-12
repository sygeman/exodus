import { type Router } from "vue-router"

export async function persistRoute({
  router,
  getRoute,
  setRoute,
}: {
  router: Router
  getRoute: () => Promise<string>
  setRoute: (hash: string) => Promise<void>
}) {
  let savedHash: string | null = null
  let restoreReceived = false
  let isRouterReady = false

  function restore(hash: string | null) {
    if (hash && hash !== "#/" && hash !== "#") {
      const path = hash.startsWith("#") ? hash.slice(1) : hash
      const [pathPart, queryString] = path.split("?")
      const query = queryString ? Object.fromEntries(new URLSearchParams(queryString)) : {}
      router.replace({ path: pathPart, query }).catch(() => {})
    }
  }

  savedHash = await getRoute()
  restoreReceived = true
  if (isRouterReady) restore(savedHash)

  router.isReady().then(() => {
    isRouterReady = true
    if (restoreReceived) restore(savedHash)
  })

  router.afterEach(() => {
    setRoute(window.location.hash)
  })
}
