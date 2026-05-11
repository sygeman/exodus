import { shallowRef, ref, onMounted, onUnmounted, watch, toValue, type MaybeRefOrGetter } from "vue"
import type { EdemClient } from "./client"
import type { InferCollectionMap, TypedItem, QueryOptions } from "./types"

type CM<T> = InferCollectionMap<T>

export function createEdemHooks<TManifest>(client: EdemClient<TManifest>) {
  function useCollectionQuery<K extends keyof CM<TManifest> & string>(
    collectionId: K,
    options?: MaybeRefOrGetter<QueryOptions | undefined>,
  ) {
    const data = shallowRef<TypedItem<CM<TManifest>[K]>[]>([])
    const total = ref(0)
    const loading = ref(true)
    const error = ref<string | null>(null)
    let unsub: (() => void) | null = null

    async function execute() {
      loading.value = true
      error.value = null
      try {
        const resolved = toValue(options)
        const result = await client.query(collectionId, resolved)
        data.value = result.items
        total.value = result.total
      } catch (e) {
        error.value = e instanceof Error ? e.message : String(e)
      } finally {
        loading.value = false
      }
    }

    function subscribe() {
      unsub = client.subscribe(
        collectionId,
        (item) => {
          data.value = [...data.value, item]
          total.value++
        },
        (item) => {
          const idx = data.value.findIndex((i) => i.id === item.id)
          if (idx !== -1) {
            data.value = [...data.value.slice(0, idx), item, ...data.value.slice(idx + 1)]
          }
        },
        (itemId) => {
          data.value = data.value.filter((i) => i.id !== itemId)
          total.value--
        },
      )
    }

    onMounted(async () => {
      await execute()
      subscribe()
    })

    onUnmounted(() => {
      unsub?.()
      unsub = null
    })

    watch(
      () => toValue(options),
      () => {
        execute()
      },
      { deep: true },
    )

    return {
      data,
      total,
      loading,
      error,
      refetch: execute,
    }
  }

  function useSingletonQuery<K extends keyof CM<TManifest> & string>(collectionId: K) {
    const data = shallowRef<TypedItem<CM<TManifest>[K]> | null>(null)
    const loading = ref(true)
    const error = ref<string | null>(null)
    let unsub: (() => void) | null = null

    async function execute() {
      loading.value = true
      error.value = null
      try {
        const result = await client.query(collectionId, { limit: 1 })
        data.value = result.items[0] ?? null
      } catch (e) {
        error.value = e instanceof Error ? e.message : String(e)
      } finally {
        loading.value = false
      }
    }

    function subscribe() {
      unsub = client.subscribe(
        collectionId,
        (item) => {
          if (!data.value) {
            data.value = item
          }
        },
        (item) => {
          data.value = item
        },
        () => {},
      )
    }

    onMounted(async () => {
      await execute()
      subscribe()
    })

    onUnmounted(() => {
      unsub?.()
      unsub = null
    })

    return {
      data,
      loading,
      error,
      refetch: execute,
    }
  }

  function useCreateItem() {
    const loading = ref(false)
    const error = ref<string | null>(null)

    async function mutate<K extends keyof CM<TManifest> & string>(
      collectionId: K,
      data: Partial<CM<TManifest>[K]>,
    ): Promise<string> {
      loading.value = true
      error.value = null
      try {
        return await client.create(collectionId, data)
      } catch (e) {
        error.value = e instanceof Error ? e.message : String(e)
        throw e
      } finally {
        loading.value = false
      }
    }

    return [mutate, { loading, error }] as const
  }

  function useUpdateItem() {
    const loading = ref(false)
    const error = ref<string | null>(null)

    async function mutate(itemId: string, data: Record<string, unknown>): Promise<string> {
      loading.value = true
      error.value = null
      try {
        return await client.update(itemId, data)
      } catch (e) {
        error.value = e instanceof Error ? e.message : String(e)
        throw e
      } finally {
        loading.value = false
      }
    }

    return [mutate, { loading, error }] as const
  }

  function useDeleteItem() {
    const loading = ref(false)
    const error = ref<string | null>(null)

    async function mutate(itemId: string): Promise<boolean> {
      loading.value = true
      error.value = null
      try {
        return await client.remove(itemId)
      } catch (e) {
        error.value = e instanceof Error ? e.message : String(e)
        throw e
      } finally {
        loading.value = false
      }
    }

    return [mutate, { loading, error }] as const
  }

  function useSingleton<K extends keyof CM<TManifest> & string>(collectionId: K) {
    const data = shallowRef<TypedItem<CM<TManifest>[K]> | null>(null)
    const loading = ref(true)
    const error = ref<string | null>(null)
    let unsub: (() => void) | null = null

    async function load() {
      loading.value = true
      error.value = null
      try {
        const result = await client.getSingleton(collectionId)
        data.value = result.item
      } catch (e) {
        error.value = e instanceof Error ? e.message : String(e)
      } finally {
        loading.value = false
      }
    }

    async function update(fields: Record<string, unknown>) {
      loading.value = true
      error.value = null
      try {
        await client.updateSingleton(collectionId, fields)
      } catch (e) {
        error.value = e instanceof Error ? e.message : String(e)
        throw e
      } finally {
        loading.value = false
      }
    }

    onMounted(async () => {
      await load()
      unsub = client.subscribeSingleton(collectionId, (item) => {
        data.value = item
      })
    })

    onUnmounted(() => {
      unsub?.()
      unsub = null
    })

    return { data, loading, error, update, reload: load }
  }

  return {
    useCollectionQuery,
    useSingletonQuery,
    useCreateItem,
    useUpdateItem,
    useDeleteItem,
    useSingleton,
  }
}
