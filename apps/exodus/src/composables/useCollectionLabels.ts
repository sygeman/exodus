import { ref, onMounted } from "vue"
import { edem } from "@/edem"
import { useI18n } from "vue-i18n"

interface FieldLabels {
  name: string
  labels?: Record<string, string>
}

interface CollectionLabels {
  name: string
  labels?: Record<string, string>
  fields: FieldLabels[]
}

const collectionsCache = ref<Map<string, CollectionLabels>>(new Map())

export function useCollectionLabels(collectionId: string) {
  const { locale } = useI18n()
  const collection = ref<CollectionLabels | null>(null)

  onMounted(async () => {
    if (collectionsCache.value.has(collectionId)) {
      collection.value = collectionsCache.value.get(collectionId)!
      return
    }

    try {
      const { collection: col } = await edem.data.getCollection({
        collection_id: collectionId,
      })
      if (col) {
        const labels: CollectionLabels = {
          name: col.name,
          labels: col.labels as Record<string, string> | undefined,
          fields: col.fields.map((f) => ({
            name: f.name,
            labels: f.labels as Record<string, string> | undefined,
          })),
        }
        collectionsCache.value.set(collectionId, labels)
        collection.value = labels
      }
    } catch {
      // ignore
    }
  })

  function fieldLabel(fieldName: string): string {
    if (!collection.value) return fieldName
    const field = collection.value.fields.find((f) => f.name === fieldName)
    if (!field?.labels) return fieldName
    return field.labels[locale.value] ?? field.labels.en ?? fieldName
  }

  function collectionLabel(): string {
    if (!collection.value) return collectionId
    if (!collection.value.labels) return collection.value.name
    return (
      collection.value.labels[locale.value] ?? collection.value.labels.en ?? collection.value.name
    )
  }

  return { collection, fieldLabel, collectionLabel }
}
