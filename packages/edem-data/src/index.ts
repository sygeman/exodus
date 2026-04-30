import { z } from "zod"
import { createEdemModule } from "@exodus/edem-core"

export const fieldSchema = z.object({
  id: z.string(),
  collection_id: z.string(),
  name: z.string(),
  type: z.string(),
  options: z.record(z.string(), z.any()).optional(),
  required: z.boolean().optional(),
  default: z.any().optional(),
  meta: z.record(z.string(), z.any()).optional(),
})

export const collectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  fields: z.array(fieldSchema),
  meta: z.record(z.string(), z.any()).optional(),
})

export const itemSchema = z.object({
  id: z.string(),
  collection_id: z.string(),
  data: z.record(z.string(), z.any()),
  created_at: z.number(),
  updated_at: z.number(),
})

export const dataModule = createEdemModule("data", (module) => {
  return module
    .context(async () => ({
      store: {
        collections: new Map<string, z.infer<typeof collectionSchema>>(),
        items: new Map<string, z.infer<typeof itemSchema>>(),
      },
    }))
    .subscription("collectionCreated", {
      output: collectionSchema,
    })
    .subscription("collectionUpdated", {
      output: collectionSchema,
    })
    .subscription("collectionDeleted", {
      output: z.object({
        collection_id: z.string(),
      }),
    })
    .subscription("itemCreated", {
      output: itemSchema,
    })
    .subscription("itemUpdated", {
      output: itemSchema,
    })
    .subscription("itemDeleted", {
      output: z.object({
        item_id: z.string(),
        collection_id: z.string(),
      }),
    })
    .mutation("createCollection", {
      input: z.object({
        name: z.string(),
        slug: z.string(),
        fields: z.array(fieldSchema).optional(),
        meta: z.record(z.string(), z.any()).optional(),
      }),
      output: z.object({
        id: z.string(),
      }),
      resolve: async ({ input, ctx, emit }) => {
        const id = crypto.randomUUID()
        const collection = {
          id,
          name: input.name,
          slug: input.slug,
          fields: input.fields ?? [],
          meta: input.meta ?? {},
        }
        ctx.store.collections.set(id, collection)
        await emit.collectionCreated(collection)
        return { id }
      },
    })
    .mutation("updateCollection", {
      input: z.object({
        collection_id: z.string(),
        name: z.string().optional(),
        slug: z.string().optional(),
        fields: z.array(fieldSchema).optional(),
        meta: z.record(z.string(), z.any()).optional(),
      }),
      output: z.object({
        id: z.string(),
      }),
      resolve: async ({ input, ctx, emit }) => {
        const collection = ctx.store.collections.get(input.collection_id)
        if (!collection) {
          throw new Error(`Collection ${input.collection_id} not found`)
        }

        if (input.name !== undefined) collection.name = input.name
        if (input.slug !== undefined) collection.slug = input.slug
        if (input.fields !== undefined) collection.fields = input.fields
        if (input.meta !== undefined) collection.meta = input.meta

        ctx.store.collections.set(input.collection_id, collection)
        await emit.collectionUpdated(collection)
        return { id: input.collection_id }
      },
    })
    .mutation("deleteCollection", {
      input: z.object({
        collection_id: z.string(),
      }),
      output: z.object({
        success: z.boolean(),
      }),
      resolve: async ({ input, ctx, emit }) => {
        const collection = ctx.store.collections.get(input.collection_id)
        if (!collection) {
          throw new Error(`Collection ${input.collection_id} not found`)
        }

        ctx.store.collections.delete(input.collection_id)
        await emit.collectionDeleted({ collection_id: input.collection_id })
        return { success: true }
      },
    })
    .mutation("createItem", {
      input: z.object({
        collection_id: z.string(),
        data: z.record(z.string(), z.any()),
      }),
      output: z.object({
        id: z.string(),
      }),
      resolve: async ({ input, ctx, emit }) => {
        const id = crypto.randomUUID()
        const now = Date.now()
        const item = {
          id,
          collection_id: input.collection_id,
          data: input.data,
          created_at: now,
          updated_at: now,
        }
        ctx.store.items.set(id, item)
        await emit.itemCreated(item)
        return { id }
      },
    })
    .mutation("updateItem", {
      input: z.object({
        item_id: z.string(),
        data: z.record(z.string(), z.any()),
      }),
      output: z.object({
        id: z.string(),
      }),
      resolve: async ({ input, ctx, emit }) => {
        const item = ctx.store.items.get(input.item_id)
        if (!item) {
          throw new Error(`Item ${input.item_id} not found`)
        }

        item.data = { ...item.data, ...input.data }
        item.updated_at = Date.now()

        ctx.store.items.set(input.item_id, item)
        await emit.itemUpdated(item)
        return { id: input.item_id }
      },
    })
    .mutation("deleteItem", {
      input: z.object({
        item_id: z.string(),
      }),
      output: z.object({
        success: z.boolean(),
      }),
      resolve: async ({ input, ctx, emit }) => {
        const item = ctx.store.items.get(input.item_id)
        if (!item) {
          throw new Error(`Item ${input.item_id} not found`)
        }

        ctx.store.items.delete(input.item_id)
        await emit.itemDeleted({ item_id: input.item_id, collection_id: item.collection_id })
        return { success: true }
      },
    })
    .query("getCollection", {
      input: z.object({
        collection_id: z.string(),
      }),
      output: z.object({
        collection: collectionSchema.nullable(),
      }),
      resolve: async ({ input, ctx }) => {
        const collection = ctx.store.collections.get(input.collection_id) ?? null
        return { collection }
      },
    })
    .query("listCollections", {
      input: z.void(),
      output: z.object({
        collections: z.array(collectionSchema),
      }),
      resolve: async ({ ctx }) => {
        return {
          collections: Array.from(ctx.store.collections.values()),
        }
      },
    })
    .query("getItem", {
      input: z.object({
        item_id: z.string(),
      }),
      output: z.object({
        item: itemSchema.nullable(),
      }),
      resolve: async ({ input, ctx }) => {
        const item = ctx.store.items.get(input.item_id) ?? null
        return { item }
      },
    })
    .query("queryItems", {
      input: z.object({
        collection_id: z.string(),
        filter: z.record(z.string(), z.any()).optional(),
        sort: z.array(z.string()).optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }),
      output: z.object({
        items: z.array(itemSchema),
        total: z.number(),
      }),
      resolve: async ({ input, ctx }) => {
        let result = Array.from(ctx.store.items.values()).filter(
          (i) => i.collection_id === input.collection_id,
        )

        if (input.limit) {
          result = result.slice(0, input.limit)
        }
        if (input.offset) {
          result = result.slice(input.offset)
        }

        return { items: result, total: result.length }
      },
    })
})

export default dataModule
