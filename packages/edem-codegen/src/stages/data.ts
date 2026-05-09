import type { Stage, StageInput, StageOutput, OutputFile, IRCollection } from "../ir"

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

    for (const col of ir.collections) {
      files.push({
        path: `src/composables/use${capitalize(col.id)}.ts`,
        content: generateComposable(col),
      })
    }

    return { files, deps: ["@exodus/edem-data"] }
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
    return generateSingletonComposable(typeName, itemType, fieldDefs)
  }

  return generateCollectionComposable(typeName, itemType, fieldDefs, col.id)
}

function generateSingletonComposable(
  typeName: string,
  itemType: string,
  fieldDefs: string,
): string {
  return `import { ref, watchEffect } from "vue"
import { edem } from "@/edem"

export interface ${itemType} {
  id: string
${fieldDefs}
}

export function use${typeName}() {
  const item = ref<${itemType} | null>(null)
  const loading = ref(true)

  async function load() {
    loading.value = true
    try {
      const result = await edem.data.queryItems({
        collection_id: "${typeName}",
      })
      if (result.items.length > 0) {
        item.value = result.items[0] as ${itemType}
      }
    } finally {
      loading.value = false
    }
  }

  watchEffect(() => {
    load()
  })

  async function update(data: Record<string, unknown>) {
    if (!item.value) return
    const result = await edem.data.updateItem({ item_id: item.value.id, data })
    await load()
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
