import { describe, it, expect } from "bun:test"
import { createEdem } from "@exodus/edem-core"
import { dataModule } from "./module"

describe("data module", () => {
  describe("createCollection", () => {
    it("should create a collection and return id", async () => {
      const edem = createEdem([dataModule])
      const result = await edem.data.createCollection({
        name: "Projects",
        slug: "projects",
        fields: [],
      })
      expect(result.id).toBeDefined()
    })

    it("should be retrievable via getCollection", async () => {
      const edem = createEdem([dataModule])
      const { id } = await edem.data.createCollection({
        name: "Projects",
        slug: "projects",
      })
      const { collection } = await edem.data.getCollection({ collection_id: id })
      expect(collection).not.toBeNull()
      expect(collection?.name).toBe("Projects")
      expect(collection?.slug).toBe("projects")
    })

    it("should appear in listCollections", async () => {
      const edem = createEdem([dataModule])
      await edem.data.createCollection({ name: "Projects", slug: "projects" })
      const { collections } = await edem.data.listCollections()
      expect(collections).toHaveLength(1)
      expect(collections[0].slug).toBe("projects")
    })
  })

  describe("createItem", () => {
    it("should create an item and return id", async () => {
      const edem = createEdem([dataModule])
      const { id: colId } = await edem.data.createCollection({ name: "Test", slug: "test" })
      const result = await edem.data.createItem({
        collection_id: colId,
        data: { title: "Test Project" },
      })
      expect(result.id).toBeDefined()
    })

    it("should be retrievable via queryItems", async () => {
      const edem = createEdem([dataModule])
      const { id: colId } = await edem.data.createCollection({ name: "Test", slug: "test" })
      await edem.data.createItem({
        collection_id: colId,
        data: { title: "Test Project" },
      })
      const { items } = await edem.data.queryItems({ collection_id: colId })
      expect(items).toHaveLength(1)
      expect(items[0].data.title).toBe("Test Project")
    })
  })

  describe("updateItem", () => {
    it("should update item data", async () => {
      const edem = createEdem([dataModule])
      const { id: colId } = await edem.data.createCollection({ name: "Test", slug: "test" })
      const { id: itemId } = await edem.data.createItem({
        collection_id: colId,
        data: { title: "Original" },
      })

      await edem.data.updateItem({ item_id: itemId, data: { title: "Updated" } })

      const { item } = await edem.data.getItem({ item_id: itemId })
      expect(item?.data.title).toBe("Updated")
    })

    it("should set updated_at greater than created_at", async () => {
      const edem = createEdem([dataModule])
      const { id: colId } = await edem.data.createCollection({ name: "Test", slug: "test" })
      const { id: itemId } = await edem.data.createItem({
        collection_id: colId,
        data: { title: "Original" },
      })

      const { item: before } = await edem.data.getItem({ item_id: itemId })
      const createdAt = before!.created_at

      await edem.data.updateItem({ item_id: itemId, data: { title: "Updated" } })

      const { item: after } = await edem.data.getItem({ item_id: itemId })
      expect(after!.updated_at).toBeGreaterThanOrEqual(createdAt)
    })

    it("should allow update when collection is deleted", async () => {
      const edem = createEdem([dataModule])
      const { id: colId } = await edem.data.createCollection({ name: "Test", slug: "test" })
      const { id: itemId } = await edem.data.createItem({
        collection_id: colId,
        data: { title: "Original" },
      })

      await edem.data.deleteCollection({ collection_id: colId })

      await edem.data.updateItem({ item_id: itemId, data: { title: "Updated" } })

      const { item } = await edem.data.getItem({ item_id: itemId })
      expect(item?.data.title).toBe("Updated")
    })
  })

  describe("deleteItem", () => {
    it("should remove item from store", async () => {
      const edem = createEdem([dataModule])
      const { id: colId } = await edem.data.createCollection({ name: "Test", slug: "test" })
      const { id: itemId } = await edem.data.createItem({
        collection_id: colId,
        data: { title: "To Delete" },
      })

      await edem.data.deleteItem({ item_id: itemId })

      const { item } = await edem.data.getItem({ item_id: itemId })
      expect(item).toBeNull()
    })
  })

  describe("deleteCollection", () => {
    it("should remove collection from store", async () => {
      const edem = createEdem([dataModule])
      const { id } = await edem.data.createCollection({ name: "Test", slug: "test" })

      await edem.data.deleteCollection({ collection_id: id })

      const { collections } = await edem.data.listCollections()
      expect(collections).toHaveLength(0)
    })
  })

  describe("updateCollection", () => {
    it("should update collection name and slug", async () => {
      const edem = createEdem([dataModule])

      const { id } = await edem.data.createCollection({
        name: "Old Name",
        slug: "old-slug",
      })

      await edem.data.updateCollection({
        collection_id: id,
        name: "New Name",
        slug: "new-slug",
      })

      const { collection } = await edem.data.getCollection({ collection_id: id })
      expect(collection?.name).toBe("New Name")
      expect(collection?.slug).toBe("new-slug")
    })

    it("should update collection fields", async () => {
      const edem = createEdem([dataModule])

      const { id } = await edem.data.createCollection({
        name: "Users",
        slug: "users",
      })

      await edem.data.updateCollection({
        collection_id: id,
        fields: [
          { id: "1", collection_id: id, name: "email", type: "string" },
          { id: "2", collection_id: id, name: "age", type: "number" },
        ],
      })

      const { collection } = await edem.data.getCollection({ collection_id: id })
      expect(collection?.fields).toHaveLength(2)
      expect(collection?.fields[0].name).toBe("email")
    })

    it("should throw on non-existent collection", async () => {
      const edem = createEdem([dataModule])

      await expect(
        edem.data.updateCollection({
          collection_id: "non-existent",
          name: "test",
        }),
      ).rejects.toThrow("not found")
    })
  })

  describe("deleteCollection", () => {
    it("should throw on non-existent collection", async () => {
      const edem = createEdem([dataModule])

      await expect(edem.data.deleteCollection({ collection_id: "non-existent" })).rejects.toThrow(
        "not found",
      )
    })
  })

  describe("getCollection", () => {
    it("should return null for non-existent collection", async () => {
      const edem = createEdem([dataModule])

      const { collection } = await edem.data.getCollection({
        collection_id: "non-existent",
      })
      expect(collection).toBeNull()
    })
  })

  describe("getItem", () => {
    it("should return null for non-existent item", async () => {
      const edem = createEdem([dataModule])

      const { item } = await edem.data.getItem({ item_id: "non-existent" })
      expect(item).toBeNull()
    })
  })

  describe("createItem", () => {
    it("should throw on non-existent collection", async () => {
      const edem = createEdem([dataModule])

      await expect(
        edem.data.createItem({
          collection_id: "non-existent",
          data: { title: "test" },
        }),
      ).rejects.toThrow("not found")
    })

    it("should validate field types on create", async () => {
      const edem = createEdem([dataModule])

      const { id: colId } = await edem.data.createCollection({
        name: "Users",
        slug: "users",
        fields: [
          { id: "1", collection_id: "", name: "email", type: "string" },
          { id: "2", collection_id: "", name: "age", type: "number" },
        ],
      })

      await expect(
        edem.data.createItem({
          collection_id: colId,
          data: { email: 123 },
        }),
      ).rejects.toThrow('Invalid value for field "email" of type "string"')

      await expect(
        edem.data.createItem({
          collection_id: colId,
          data: { age: "not a number" },
        }),
      ).rejects.toThrow('Invalid value for field "age" of type "number"')
    })

    it("should enforce required fields", async () => {
      const edem = createEdem([dataModule])

      const { id: colId } = await edem.data.createCollection({
        name: "Users",
        slug: "users",
        fields: [{ id: "1", collection_id: "", name: "email", type: "string", required: true }],
      })

      await expect(
        edem.data.createItem({
          collection_id: colId,
          data: {},
        }),
      ).rejects.toThrow('Field "email" is required')
    })
  })

  describe("updateItem", () => {
    it("should throw on non-existent item", async () => {
      const edem = createEdem([dataModule])

      await expect(
        edem.data.updateItem({
          item_id: "non-existent",
          data: { title: "test" },
        }),
      ).rejects.toThrow("not found")
    })

    it("should validate field types on update", async () => {
      const edem = createEdem([dataModule])

      const { id: colId } = await edem.data.createCollection({
        name: "Users",
        slug: "users",
        fields: [{ id: "1", collection_id: "", name: "age", type: "number" }],
      })

      const { id: itemId } = await edem.data.createItem({
        collection_id: colId,
        data: { age: 25 },
      })

      await expect(
        edem.data.updateItem({
          item_id: itemId,
          data: { age: "not a number" },
        }),
      ).rejects.toThrow('Invalid value for field "age" of type "number"')
    })

    it("should merge data on update", async () => {
      const edem = createEdem([dataModule])

      const { id: colId } = await edem.data.createCollection({
        name: "Items",
        slug: "items",
      })

      const { id: itemId } = await edem.data.createItem({
        collection_id: colId,
        data: { a: 1, b: 2 },
      })

      await edem.data.updateItem({
        item_id: itemId,
        data: { b: 99, c: 3 },
      })

      const { item } = await edem.data.getItem({ item_id: itemId })
      expect(item?.data).toEqual({ a: 1, b: 99, c: 3 })
    })
  })

  describe("deleteItem", () => {
    it("should throw on non-existent item", async () => {
      const edem = createEdem([dataModule])

      await expect(edem.data.deleteItem({ item_id: "non-existent" })).rejects.toThrow("not found")
    })
  })

  describe("events", () => {
    it("should emit collectionCreated with full payload", async () => {
      const edem = createEdem([dataModule])
      const events: any[] = []

      edem.data.collectionCreated(async ({ event }) => {
        events.push(event)
      })

      await edem.data.createCollection({
        name: "Test",
        slug: "test",
        fields: [{ id: "1", collection_id: "", name: "email", type: "string" }],
        meta: { icon: "folder" },
      })

      expect(events).toHaveLength(1)
      expect(events[0].name).toBe("Test")
      expect(events[0].slug).toBe("test")
      expect(events[0].fields).toHaveLength(1)
      expect(events[0].meta).toEqual({ icon: "folder" })
    })

    it("should emit collectionUpdated with full payload", async () => {
      const edem = createEdem([dataModule])
      const events: any[] = []

      edem.data.collectionUpdated(async ({ event }) => {
        events.push(event)
      })

      const { id } = await edem.data.createCollection({ name: "Test", slug: "test" })
      await edem.data.updateCollection({ collection_id: id, name: "Updated", slug: "updated" })

      expect(events).toHaveLength(1)
      expect(events[0].name).toBe("Updated")
      expect(events[0].slug).toBe("updated")
      expect(events[0].id).toBe(id)
    })

    it("should emit collectionDeleted with collection_id", async () => {
      const edem = createEdem([dataModule])
      const events: any[] = []

      edem.data.collectionDeleted(async ({ event }) => {
        events.push(event)
      })

      const { id } = await edem.data.createCollection({ name: "Test", slug: "test" })
      await edem.data.deleteCollection({ collection_id: id })

      expect(events).toHaveLength(1)
      expect(events[0].collection_id).toBe(id)
    })

    it("should emit itemCreated with full payload", async () => {
      const edem = createEdem([dataModule])
      const events: any[] = []

      edem.data.itemCreated(async ({ event }) => {
        events.push(event)
      })

      const { id: colId } = await edem.data.createCollection({ name: "Test", slug: "test" })
      await edem.data.createItem({
        collection_id: colId,
        data: { title: "Item" },
      })

      expect(events).toHaveLength(1)
      expect(events[0].collection_id).toBe(colId)
      expect(events[0].data).toEqual({ title: "Item" })
      expect(events[0].created_at).toBeTypeOf("number")
      expect(events[0].updated_at).toBeTypeOf("number")
    })

    it("should emit itemUpdated with full payload", async () => {
      const edem = createEdem([dataModule])
      const events: any[] = []

      edem.data.itemUpdated(async ({ event }) => {
        events.push(event)
      })

      const { id: colId } = await edem.data.createCollection({ name: "Test", slug: "test" })
      const { id: itemId } = await edem.data.createItem({
        collection_id: colId,
        data: { title: "Item" },
      })

      const { item: before } = await edem.data.getItem({ item_id: itemId })

      await edem.data.updateItem({ item_id: itemId, data: { title: "Updated" } })

      expect(events).toHaveLength(1)
      expect(events[0].id).toBe(itemId)
      expect(events[0].data.title).toBe("Updated")
      expect(events[0].updated_at).toBeGreaterThanOrEqual(before!.created_at)
    })

    it("should emit itemDeleted with item_id and collection_id", async () => {
      const edem = createEdem([dataModule])
      const events: any[] = []

      edem.data.itemDeleted(async ({ event }) => {
        events.push(event)
      })

      const { id: colId } = await edem.data.createCollection({ name: "Test", slug: "test" })
      const { id: itemId } = await edem.data.createItem({
        collection_id: colId,
        data: { title: "Item" },
      })
      await edem.data.deleteItem({ item_id: itemId })

      expect(events).toHaveLength(1)
      expect(events[0].item_id).toBe(itemId)
      expect(events[0].collection_id).toBe(colId)
    })
  })

  describe("pagination edge cases", () => {
    it("should handle offset: 0", async () => {
      const edem = createEdem([dataModule])

      const { id: colId } = await edem.data.createCollection({ name: "Test", slug: "test" })
      await edem.data.createItem({ collection_id: colId, data: { i: 1 } })
      await edem.data.createItem({ collection_id: colId, data: { i: 2 } })

      const { items } = await edem.data.queryItems({
        collection_id: colId,
        limit: 1,
        offset: 0,
      })

      expect(items).toHaveLength(1)
      expect(items[0].data.i).toBe(1)
    })

    it("should handle limit: 0", async () => {
      const edem = createEdem([dataModule])

      const { id: colId } = await edem.data.createCollection({ name: "Test", slug: "test" })
      await edem.data.createItem({ collection_id: colId, data: { i: 1 } })

      const { items, total } = await edem.data.queryItems({
        collection_id: colId,
        limit: 0,
      })

      expect(total).toBe(1)
      expect(items).toHaveLength(0)
    })
  })

  describe("required fields on update", () => {
    it("should enforce required fields when setting to null", async () => {
      const edem = createEdem([dataModule])

      const { id: colId } = await edem.data.createCollection({
        name: "Users",
        slug: "users",
        fields: [{ id: "1", collection_id: "", name: "email", type: "string", required: true }],
      })

      const { id: itemId } = await edem.data.createItem({
        collection_id: colId,
        data: { email: "test@example.com" },
      })

      await expect(
        edem.data.updateItem({
          item_id: itemId,
          data: { email: null },
        }),
      ).rejects.toThrow('Field "email" is required')
    })

    it("should preserve required field when omitted from update", async () => {
      const edem = createEdem([dataModule])

      const { id: colId } = await edem.data.createCollection({
        name: "Users",
        slug: "users",
        fields: [{ id: "1", collection_id: "", name: "email", type: "string", required: true }],
      })

      const { id: itemId } = await edem.data.createItem({
        collection_id: colId,
        data: { email: "test@example.com" },
      })

      await edem.data.updateItem({
        item_id: itemId,
        data: { extra: "data" },
      })

      const { item } = await edem.data.getItem({ item_id: itemId })
      expect(item?.data.email).toBe("test@example.com")
      expect(item?.data.extra).toBe("data")
    })
  })
})
