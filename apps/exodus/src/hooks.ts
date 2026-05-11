import { createEdemHooks } from "@exodus/edem-vue"
import { client } from "./edem-client"
import type { dataManifest } from "./data-manifest"

export const {
  useCollectionQuery,
  useSingletonQuery,
  useCreateItem,
  useUpdateItem,
  useDeleteItem,
} = createEdemHooks<typeof dataManifest>(client)
