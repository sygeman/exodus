import { ref, onMounted, onUnmounted } from "vue"
import type { InferModuleAPI } from "@exodus/edem-core"
import type { electrobunModule } from "@exodus/edem-electrobun/module"

type ElectrobunAPI = InferModuleAPI<typeof electrobunModule>

export function createElectrobunHooks(electrobun: ElectrobunAPI) {
  function useUpdateStatus() {
    const status = ref<string>("idle")
    const currentVersion = ref<string | undefined>(undefined)
    const latestVersion = ref<string | undefined>(undefined)
    const error = ref<string | undefined>(undefined)
    let unsub: (() => void) | null = null

    onMounted(() => {
      unsub = electrobun.updateStatus(({ event }) => {
        status.value = event.status
        currentVersion.value = event.current_version
        latestVersion.value = event.latest_version
        error.value = event.error
      })
    })

    onUnmounted(() => {
      unsub?.()
      unsub = null
    })

    return { status, currentVersion, latestVersion, error }
  }

  function useVersion() {
    const version = ref("")
    const loading = ref(true)
    const error = ref<string | null>(null)

    async function fetch() {
      loading.value = true
      error.value = null
      try {
        const result = await electrobun.getVersion({})
        version.value = result.version
      } catch (e) {
        error.value = e instanceof Error ? e.message : String(e)
      } finally {
        loading.value = false
      }
    }

    onMounted(() => fetch())

    return { version, loading, error, refetch: fetch }
  }

  function useCheckUpdate() {
    const loading = ref(false)
    const error = ref<string | null>(null)

    async function mutate(): Promise<
      | {
          available: boolean
          current_version?: string
          latest_version?: string
          error?: string | null
        }
      | never
    > {
      loading.value = true
      error.value = null
      try {
        return await electrobun.checkUpdate({})
      } catch (e) {
        error.value = e instanceof Error ? e.message : String(e)
        throw e
      } finally {
        loading.value = false
      }
    }

    return [mutate, { loading, error }] as const
  }

  function useStartUpdate() {
    const loading = ref(false)
    const error = ref<string | null>(null)

    async function mutate(): Promise<{ success: boolean; error?: string | null } | never> {
      loading.value = true
      error.value = null
      try {
        return await electrobun.startUpdate({})
      } catch (e) {
        error.value = e instanceof Error ? e.message : String(e)
        throw e
      } finally {
        loading.value = false
      }
    }

    return [mutate, { loading, error }] as const
  }

  return { useUpdateStatus, useVersion, useCheckUpdate, useStartUpdate }
}
