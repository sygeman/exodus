import type { Stage, StageInput, StageOutput, OutputFile, IRCollection } from "../ir"
import { capitalize } from "../utils"

// ── Data Stage ────────────────────────────────────────────────────────────────
// Generates data composables and manifest loader.

export const dataStage: Stage = {
  name: "data",

  async handle({ ir }: StageInput): Promise<StageOutput> {
    const files: OutputFile[] = []

    if (ir.collections.length === 0) {
      return { files, deps: [] }
    }

    files.push({
      path: "src/manifest.ts",
      content: generateManifest(),
    })

    files.push({
      path: "src/data-manifest.ts",
      content: generateDataManifest(ir.collections),
    })

    files.push({
      path: "src/edem-client.ts",
      content: generateEdemClient(),
    })

    files.push({
      path: "src/hooks.ts",
      content: generateHooks(),
    })

    for (const col of ir.collections) {
      files.push({
        path: `src/composables/use${capitalize(col.id)}.ts`,
        content: generateComposable(col),
      })
    }

    return { files, deps: ["@exodus/edem-data", "@exodus/edem-vue"] }
  },
}

// ── Generators ────────────────────────────────────────────────────────────────

function generateManifest(): string {
  return `import type { dataModule, Manifest } from "@exodus/edem-data"
import type { InferModuleAPI } from "@exodus/edem-core"
import manifest from "../edem-manifests/data.json"

type EdemData = InferModuleAPI<typeof dataModule>

export const SYSTEM_MANIFEST: Manifest = manifest as Manifest

export async function ensureCollections(data: EdemData): Promise<void> {
  await data.applyManifest({ manifest: SYSTEM_MANIFEST })
}
`
}

function generateDataManifest(collections: IRCollection[]): string {
  const body = collections
    .map((collection) => {
      const fields = collection.fields
        .map((field) => {
          const entries = [
            `name: ${JSON.stringify(field.name)}`,
            `type: ${JSON.stringify(field.type)}`,
          ]

          if (field.required) {
            entries.push("required: true")
          }

          if (field.default !== undefined) {
            entries.push(`default: ${JSON.stringify(field.default)}`)
          }

          if (field.labels) {
            entries.push(`labels: ${JSON.stringify(field.labels)}`)
          }

          return `        { ${entries.join(", ")} },`
        })
        .join("\n")

      const prefix = [`id: ${JSON.stringify(collection.id)}`]
      if (collection.singleton) {
        prefix.push("singleton: true")
      }

      return `    {
      ${prefix.join(",\n      ")},
      fields: [
${fields}
      ],
    },`
    })
    .join("\n")

  return `export const dataManifest = {
  collections: [
${body}
  ],
} as const
`
}

function generateEdemClient(): string {
  return `import { EdemClient } from "@exodus/edem-vue"
import { edem } from "./edem"
import { dataManifest } from "./data-manifest"

export const client = new EdemClient<typeof dataManifest>(edem.data)
`
}

function generateHooks(): string {
  return `import { createEdemHooks, createElectrobunHooks, createFlowsHooks } from "@exodus/edem-vue"
import { client } from "./edem-client"
import { edem } from "./edem"
import type { dataManifest } from "./data-manifest"

export const { useCollectionQuery, useCreateItem, useUpdateItem, useDeleteItem, useSingleton } =
  createEdemHooks<typeof dataManifest>(client)

export const { useUpdateStatus, useVersion, useCheckUpdate, useStartUpdate } =
  createElectrobunHooks(edem.electrobun)

export const {
  useFlows,
  useFlow,
  useFlowRuns,
  useRun,
  useRunNodes,
  useCreateFlow,
  useUpdateFlow,
  useDeleteFlow,
  useRunFlow,
  useCancelRun,
  useResumeRun,
  useDeleteRuns,
} = createFlowsHooks(edem.flows)
`
}

function generateComposable(col: IRCollection): string {
  const typeName = capitalize(col.id)
  const itemType = `${typeName}Item`

  const fieldDefs = col.fields
    .map((f) => {
      const nullable = f.required ? "" : " | null"
      return `  ${f.name}: ${f.tsType}${nullable}`
    })
    .join(",\n")

  if (col.singleton) {
    return generateSingletonComposable(typeName, itemType, fieldDefs, col.id)
  }

  return generateCollectionComposable(typeName, itemType, fieldDefs, col.id)
}

function generateSingletonComposable(
  typeName: string,
  itemType: string,
  fieldDefs: string,
  collectionId: string,
): string {
  return `import { ref, onMounted, onUnmounted } from "vue"
import { edem } from "@/edem"

export interface ${itemType} {
  id: string
${fieldDefs}
}

export function use${typeName}() {
  const item = ref<${itemType} | null>(null)
  const loading = ref(true)
  let unsub: (() => void) | null = null

  async function load() {
    loading.value = true
    try {
      const result = await edem.data.getSingleton({
        collection_id: "${collectionId}",
      })
      item.value = result.item as ${itemType} | null
    } finally {
      loading.value = false
    }
  }

  onMounted(async () => {
    await load()
    unsub = edem.data.itemUpdated(({ event }) => {
      if (event.collection_id === "${collectionId}") {
        item.value = event as ${itemType}
      }
    })
  })

  onUnmounted(() => {
    unsub?.()
    unsub = null
  })

  async function update(data: Record<string, unknown>) {
    const result = await edem.data.updateSingleton({
      collection_id: "${collectionId}",
      data,
    })
    return result
  }

  return { item, loading, update, reload: load }
}
`
}

function generateCollectionComposable(
  typeName: string,
  itemType: string,
  fieldDefs: string,
  collectionId: string,
): string {
  return `import { ref, watchEffect } from "vue"
import { edem } from "@/edem"

export interface ${itemType} {
  id: string
${fieldDefs}
}

export function use${typeName}(options?: { filter?: Record<string, unknown> }) {
  const items = ref<${itemType}[]>([])
  const loading = ref(true)
  const unsubs: (() => void)[] = []

  async function load(filter?: Record<string, unknown>) {
    loading.value = true
    try {
      const result = await edem.data.queryItems({
        collection_id: "${collectionId}",
        filter: filter ?? options?.filter ?? {},
      })
      items.value = result.items as ${itemType}[]
    } finally {
      loading.value = false
    }
  }

  function subscribe() {
    unsubs.push(
      edem.data.itemCreated(async ({ event: item }) => {
        if (item.collection_id !== "${collectionId}") return
        if (items.value.some((i) => i.id === item.id)) return
        items.value.push(item as ${itemType})
      }),
    )
    unsubs.push(
      edem.data.itemUpdated(async ({ event: item }) => {
        if (item.collection_id !== "${collectionId}") return
        const idx = items.value.findIndex((i) => i.id === item.id)
        if (idx !== -1) items.value[idx] = item as ${itemType}
      }),
    )
    unsubs.push(
      edem.data.itemDeleted(async ({ event }) => {
        items.value = items.value.filter((i) => i.id !== event.item_id)
      }),
    )
  }

  watchEffect(() => {
    load()
    subscribe()
  })

  async function create(data: Record<string, unknown>) {
    const result = await edem.data.createItem({ collection_id: "${collectionId}", data })
    await load()
    return result
  }

  async function update(id: string, data: Record<string, unknown>) {
    const result = await edem.data.updateItem({ item_id: id, data })
    await load()
    return result
  }

  async function remove(id: string) {
    await edem.data.deleteItem({ item_id: id })
    await load()
  }

  return { items, loading, create, update, remove, reload: load }
}
`
}
