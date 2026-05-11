import type { InferCollectionMap, EdemData, TypedItem, QueryOptions, QueryResult } from "./types"

type CM<T> = InferCollectionMap<T>

export class EdemClient<TManifest> {
  private data: EdemData

  constructor(data: EdemData) {
    this.data = data
  }

  async query<K extends keyof CM<TManifest> & string>(
    collectionId: K,
    options?: QueryOptions,
  ): Promise<QueryResult<CM<TManifest>[K]>> {
    return this.data.queryItems({ collection_id: collectionId, ...options }) as Promise<
      QueryResult<CM<TManifest>[K]>
    >
  }

  async create<K extends keyof CM<TManifest> & string>(
    collectionId: K,
    record: Partial<CM<TManifest>[K]>,
  ): Promise<string> {
    const { id } = await this.data.createItem({
      collection_id: collectionId,
      data: record as Record<string, unknown>,
    })
    return id
  }

  async update(itemId: string, data: Record<string, unknown>): Promise<string> {
    const { id } = await this.data.updateItem({ item_id: itemId, data })
    return id
  }

  async remove(itemId: string): Promise<boolean> {
    const { success } = await this.data.deleteItem({ item_id: itemId })
    return success
  }

  subscribe<K extends keyof CM<TManifest> & string>(
    collectionId: K,
    onCreated: (item: TypedItem<CM<TManifest>[K]>) => void,
    onUpdated: (item: TypedItem<CM<TManifest>[K]>) => void,
    onDeleted: (itemId: string) => void,
  ): () => void {
    const unsubs: (() => void)[] = []

    unsubs.push(
      this.data.itemCreated(({ event: item }) => {
        if (item.collection_id === collectionId) onCreated(item as TypedItem<CM<TManifest>[K]>)
      }),
    )

    unsubs.push(
      this.data.itemUpdated(({ event: item }) => {
        if (item.collection_id === collectionId) onUpdated(item as TypedItem<CM<TManifest>[K]>)
      }),
    )

    unsubs.push(
      this.data.itemDeleted(({ event }) => {
        if (event.collection_id === collectionId) onDeleted(event.item_id as string)
      }),
    )

    return () => {
      for (const unsub of unsubs) unsub()
    }
  }
}
