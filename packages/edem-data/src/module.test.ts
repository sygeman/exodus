import { describe, it, expect, beforeEach } from "bun:test"
import { createEdem } from "@exodus/edem-core"
import { dataModule } from "./module"
import { resetDataEngine } from "./db"

describe("data module", () => {
  let edem: ReturnType<typeof createEdem<[typeof dataModule]>>

  beforeEach(async () => {
    resetDataEngine()
    edem = createEdem([dataModule])
  })

  describe("createCollection", () => {
    it("should create a collection and return id", async () => {
      const result = await edem.data.createCollection({
        name: "Projects",
        id: "projects",
        fields: [],
      })
      expect(result.id).toBeDefined()
    })

    it("should be retrievable via getCollection", async () => {
      const { id } = await edem.data.createCollection({
        name: "Projects",
        id: "projects",
      })
      const { collection } = await edem.data.getCollection({ collection_id: id })
      expect(collection).not.toBeNull()
      expect(collection?.name).toBe("Projects")
      expect(collection?.id).toBe("projects")
    })

    it("should appear in listCollections", async () => {
      await edem.data.createCollection({
        name: "Projects",
        id: "projects",
      })
      const { collections } = await edem.data.listCollections({})
      expect(collections).toHaveLength(1)
      expect(collections[0].id).toBe("projects")
    })
  })

  describe("createItem", () => {
    it("should create an item and return id", async () => {
      const { id: colId } = await edem.data.createCollection({
        name: "Test",
        id: "test",
      })
      const result = await edem.data.createItem({
        collection_id: colId,
        data: { title: "Test Project" },
      })
      expect(result.id).toBeDefined()
    })

    it("should be retrievable via queryItems", async () => {
      const { id: colId } = await edem.data.createCollection({
        name: "Test",
        id: "test",
      })
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
      const { id: colId } = await edem.data.createCollection({
        name: "Test",
        id: "test",
      })
      const { id: itemId } = await edem.data.createItem({
        collection_id: colId,
        data: { title: "Original" },
      })

      await edem.data.updateItem({ item_id: itemId, data: { title: "Updated" } })

      const { item } = await edem.data.getItem({ item_id: itemId })
      expect(item?.data.title).toBe("Updated")
    })

    it("should set updated_at greater than created_at", async () => {
      const { id: colId } = await edem.data.createCollection({
        name: "Test",
        id: "test",
      })
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
      const { id: colId } = await edem.data.createCollection({
        name: "Test",
        id: "test",
      })
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
      const { id: colId } = await edem.data.createCollection({
        name: "Test",
        id: "test",
      })
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
      const { id } = await edem.data.createCollection({
        name: "Test",
        id: "test",
      })

      await edem.data.deleteCollection({ collection_id: id })

      const { collections } = await edem.data.listCollections({})
      expect(collections).toHaveLength(0)
    })
  })

  describe("updateCollection", () => {
    it("should update collection name", async () => {
      const { id } = await edem.data.createCollection({
        name: "Old Name",
        id: "test-col",
      })

      await edem.data.updateCollection({
        collection_id: id,
        name: "New Name",
      })

      const { collection } = await edem.data.getCollection({ collection_id: id })
      expect(collection?.name).toBe("New Name")
    })

    it("should update collection fields", async () => {
      const { id } = await edem.data.createCollection({
        name: "Users",
        id: "users",
      })

      await edem.data.updateCollection({
        collection_id: id,
        fields: [
          { name: "email", type: "string" },
          { name: "age", type: "number" },
        ],
      })

      const { collection } = await edem.data.getCollection({ collection_id: id })
      expect(collection?.fields).toHaveLength(2)
      expect(collection?.fields[0].name).toBe("email")
    })

    it("should throw on non-existent collection", async () => {
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
      await expect(edem.data.deleteCollection({ collection_id: "non-existent" })).rejects.toThrow(
        "not found",
      )
    })
  })

  describe("getCollection", () => {
    it("should return null for non-existent collection", async () => {
      const { collection } = await edem.data.getCollection({
        collection_id: "non-existent",
      })
      expect(collection).toBeNull()
    })
  })

  describe("getItem", () => {
    it("should return null for non-existent item", async () => {
      const { item } = await edem.data.getItem({ item_id: "non-existent" })
      expect(item).toBeNull()
    })
  })

  describe("createItem", () => {
    it("should throw on non-existent collection", async () => {
      await expect(
        edem.data.createItem({
          collection_id: "non-existent",
          data: { title: "test" },
        }),
      ).rejects.toThrow("not found")
    })

    it("should validate field types on create", async () => {
      const { id: colId } = await edem.data.createCollection({
        name: "Users",
        id: "users",
        fields: [
          { name: "email", type: "string" },
          { name: "age", type: "number" },
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
      const { id: colId } = await edem.data.createCollection({
        name: "Users",
        id: "users",
        fields: [{ name: "email", type: "string", required: true }],
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
      await expect(
        edem.data.updateItem({
          item_id: "non-existent",
          data: { title: "test" },
        }),
      ).rejects.toThrow("not found")
    })

    it("should validate field types on update", async () => {
      const { id: colId } = await edem.data.createCollection({
        name: "Users",
        id: "users",
        fields: [{ name: "age", type: "number" }],
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
  })

  describe("deleteItem", () => {
    it("should throw on non-existent item", async () => {
      await expect(edem.data.deleteItem({ item_id: "non-existent" })).rejects.toThrow("not found")
    })
  })

  describe("queryItems", () => {
    it("should filter items by data", async () => {
      const { id: colId } = await edem.data.createCollection({
        name: "Test",
        id: "test",
      })
      await edem.data.createItem({ collection_id: colId, data: { status: "published" } })
      await edem.data.createItem({ collection_id: colId, data: { status: "draft" } })

      const { items } = await edem.data.queryItems({
        collection_id: colId,
        filter: { status: { _eq: "published" } },
      })
      expect(items).toHaveLength(1)
      expect(items[0].data.status).toBe("published")
    })

    it("should sort items", async () => {
      const { id: colId } = await edem.data.createCollection({
        name: "Test",
        id: "test",
      })
      await edem.data.createItem({ collection_id: colId, data: { name: "B" } })
      await edem.data.createItem({ collection_id: colId, data: { name: "A" } })

      const { items } = await edem.data.queryItems({
        collection_id: colId,
        sort: ["name"],
      })
      expect(items[0].data.name).toBe("A")
      expect(items[1].data.name).toBe("B")
    })

    it("should sort items descending", async () => {
      const { id: colId } = await edem.data.createCollection({
        name: "Test",
        id: "test",
      })
      await edem.data.createItem({ collection_id: colId, data: { name: "A" } })
      await edem.data.createItem({ collection_id: colId, data: { name: "B" } })

      const { items } = await edem.data.queryItems({
        collection_id: colId,
        sort: ["-name"],
      })
      expect(items[0].data.name).toBe("B")
      expect(items[1].data.name).toBe("A")
    })

    it("should return total count", async () => {
      const { id: colId } = await edem.data.createCollection({
        name: "Test",
        id: "test",
      })
      await edem.data.createItem({ collection_id: colId, data: { name: "A" } })
      await edem.data.createItem({ collection_id: colId, data: { name: "B" } })
      await edem.data.createItem({ collection_id: colId, data: { name: "C" } })

      const { items, total } = await edem.data.queryItems({
        collection_id: colId,
        limit: 2,
      })
      expect(items).toHaveLength(2)
      expect(total).toBe(3)
    })

    it("should handle offset", async () => {
      const { id: colId } = await edem.data.createCollection({
        name: "Test",
        id: "test",
      })
      await edem.data.createItem({ collection_id: colId, data: { name: "A" } })
      await edem.data.createItem({ collection_id: colId, data: { name: "B" } })
      await edem.data.createItem({ collection_id: colId, data: { name: "C" } })

      const { items } = await edem.data.queryItems({
        collection_id: colId,
        offset: 1,
        limit: 2,
      })
      expect(items).toHaveLength(2)
      expect(items[0].data.name).toBe("B")
    })

    it("should filter with _gt operator", async () => {
      const { id: colId } = await edem.data.createCollection({
        name: "Test",
        id: "test",
      })
      await edem.data.createItem({ collection_id: colId, data: { age: 18 } })
      await edem.data.createItem({ collection_id: colId, data: { age: 25 } })
      await edem.data.createItem({ collection_id: colId, data: { age: 30 } })

      const { items } = await edem.data.queryItems({
        collection_id: colId,
        filter: { age: { _gt: 20 } },
      })
      expect(items).toHaveLength(2)
    })

    it("should filter with _contains operator", async () => {
      const { id: colId } = await edem.data.createCollection({
        name: "Test",
        id: "test",
      })
      await edem.data.createItem({ collection_id: colId, data: { title: "Hello World" } })
      await edem.data.createItem({ collection_id: colId, data: { title: "Goodbye" } })

      const { items } = await edem.data.queryItems({
        collection_id: colId,
        filter: { title: { _contains: "Hello" } },
      })
      expect(items).toHaveLength(1)
    })

    it("should filter with _and operator", async () => {
      const { id: colId } = await edem.data.createCollection({
        name: "Test",
        id: "test",
      })
      await edem.data.createItem({ collection_id: colId, data: { status: "published", age: 25 } })
      await edem.data.createItem({ collection_id: colId, data: { status: "draft", age: 30 } })
      await edem.data.createItem({ collection_id: colId, data: { status: "published", age: 18 } })

      const { items } = await edem.data.queryItems({
        collection_id: colId,
        filter: {
          _and: [{ status: { _eq: "published" } }, { age: { _gt: 20 } }],
        },
      })
      expect(items).toHaveLength(1)
      expect(items[0].data.age).toBe(25)
    })

    it("should filter with _or operator", async () => {
      const { id: colId } = await edem.data.createCollection({
        name: "Test",
        id: "test",
      })
      await edem.data.createItem({ collection_id: colId, data: { status: "published" } })
      await edem.data.createItem({ collection_id: colId, data: { status: "draft" } })
      await edem.data.createItem({ collection_id: colId, data: { status: "archived" } })

      const { items } = await edem.data.queryItems({
        collection_id: colId,
        filter: {
          _or: [{ status: { _eq: "published" } }, { status: { _eq: "draft" } }],
        },
      })
      expect(items).toHaveLength(2)
    })

    it("should filter with _in operator", async () => {
      const { id: colId } = await edem.data.createCollection({
        name: "Test",
        id: "test",
      })
      await edem.data.createItem({ collection_id: colId, data: { status: "published" } })
      await edem.data.createItem({ collection_id: colId, data: { status: "draft" } })
      await edem.data.createItem({ collection_id: colId, data: { status: "archived" } })

      const { items } = await edem.data.queryItems({
        collection_id: colId,
        filter: { status: { _in: ["published", "draft"] } },
      })
      expect(items).toHaveLength(2)
    })

    it("should filter with _between operator", async () => {
      const { id: colId } = await edem.data.createCollection({
        name: "Test",
        id: "test",
      })
      await edem.data.createItem({ collection_id: colId, data: { price: 10 } })
      await edem.data.createItem({ collection_id: colId, data: { price: 50 } })
      await edem.data.createItem({ collection_id: colId, data: { price: 100 } })

      const { items } = await edem.data.queryItems({
        collection_id: colId,
        filter: { price: { _between: [5, 60] } },
      })
      expect(items).toHaveLength(2)
      expect(items[0].data.price).toBe(10)
      expect(items[1].data.price).toBe(50)
    })

    it("should sort by created_at by default", async () => {
      const { id: colId } = await edem.data.createCollection({
        name: "Test",
        id: "test",
      })
      const { id: first } = await edem.data.createItem({
        collection_id: colId,
        data: { name: "First" },
      })
      const { id: second } = await edem.data.createItem({
        collection_id: colId,
        data: { name: "Second" },
      })

      const { items } = await edem.data.queryItems({
        collection_id: colId,
        sort: ["created_at"],
      })
      expect(items[0].id).toBe(first)
      expect(items[1].id).toBe(second)
    })

    it("should handle multiple sort fields", async () => {
      const { id: colId } = await edem.data.createCollection({
        name: "Test",
        id: "test",
      })
      await edem.data.createItem({ collection_id: colId, data: { category: "A", name: "Z" } })
      await edem.data.createItem({ collection_id: colId, data: { category: "A", name: "A" } })
      await edem.data.createItem({ collection_id: colId, data: { category: "B", name: "M" } })

      const { items } = await edem.data.queryItems({
        collection_id: colId,
        sort: ["category", "name"],
      })
      expect(items[0].data.name).toBe("A")
      expect(items[1].data.name).toBe("Z")
      expect(items[2].data.name).toBe("M")
    })
  })

  describe("schema migration", () => {
    it("should not break queries when fields are removed", async () => {
      const { id: colId } = await edem.data.createCollection({
        name: "Test",
        id: "test",
        fields: [{ name: "title", type: "string" }],
      })

      await edem.data.createItem({ collection_id: colId, data: { title: "Old Item" } })

      await edem.data.updateCollection({
        collection_id: colId,
        fields: [{ name: "name", type: "string" }],
      })

      const { items } = await edem.data.queryItems({ collection_id: colId })
      expect(items).toHaveLength(1)
      expect(items[0].data.title).toBe("Old Item")
    })

    it("should not break queries when fields are added", async () => {
      const { id: colId } = await edem.data.createCollection({
        name: "Test",
        id: "test",
        fields: [{ name: "title", type: "string" }],
      })

      await edem.data.createItem({ collection_id: colId, data: { title: "Old Item" } })

      await edem.data.updateCollection({
        collection_id: colId,
        fields: [
          { name: "title", type: "string" },
          { name: "description", type: "text" },
        ],
      })

      const { items } = await edem.data.queryItems({ collection_id: colId })
      expect(items).toHaveLength(1)
      expect(items[0].data.title).toBe("Old Item")
    })

    it("should allow creating items with new fields after schema change", async () => {
      const { id: colId } = await edem.data.createCollection({
        name: "Test",
        id: "test",
        fields: [{ name: "title", type: "string" }],
      })

      await edem.data.updateCollection({
        collection_id: colId,
        fields: [
          { name: "title", type: "string" },
          { name: "description", type: "text" },
        ],
      })

      await edem.data.createItem({
        collection_id: colId,
        data: { title: "New Item", description: "With description" },
      })

      const { items } = await edem.data.queryItems({ collection_id: colId })
      expect(items).toHaveLength(1)
      expect(items[0].data.description).toBe("With description")
    })

    it("should preserve old data when new required field is added", async () => {
      const { id: colId } = await edem.data.createCollection({
        name: "Test",
        id: "test",
        fields: [{ name: "title", type: "string" }],
      })

      await edem.data.createItem({ collection_id: colId, data: { title: "Old Item" } })

      await edem.data.updateCollection({
        collection_id: colId,
        fields: [
          { name: "title", type: "string" },
          {
            name: "status",
            type: "string",
            required: true,
            default: "draft",
          },
        ],
      })

      const { items } = await edem.data.queryItems({ collection_id: colId })
      expect(items).toHaveLength(1)
      expect(items[0].data.title).toBe("Old Item")
      expect(items[0].data.status).toBeUndefined()
    })

    it("should track schema version", async () => {
      const { id: colId } = await edem.data.createCollection({
        name: "Test",
        id: "test",
        fields: [{ name: "title", type: "string" }],
      })

      await edem.data.updateCollection({
        collection_id: colId,
        fields: [
          { name: "title", type: "string" },
          { name: "description", type: "text" },
        ],
      })

      const { collection } = await edem.data.getCollection({ collection_id: colId })
      expect(collection?.schema_version).toBe(1)
    })

    it("should keep old items queryable after field type change", async () => {
      const { id: colId } = await edem.data.createCollection({
        name: "Test",
        id: "test",
        fields: [{ name: "value", type: "string" }],
      })

      await edem.data.createItem({ collection_id: colId, data: { value: "old text" } })

      await edem.data.updateCollection({
        collection_id: colId,
        fields: [{ name: "value", type: "number" }],
      })

      await edem.data.createItem({ collection_id: colId, data: { value: 42 } })

      const { items } = await edem.data.queryItems({ collection_id: colId })
      expect(items).toHaveLength(2)
    })
  })

  describe("searchItems", () => {
    it("should search items by query", async () => {
      const { id: colId } = await edem.data.createCollection({
        name: "Products",
        id: "products",
      })

      await edem.data.createItem({
        collection_id: colId,
        data: { name: "iPhone 15", brand: "Apple" },
      })
      await edem.data.createItem({
        collection_id: colId,
        data: { name: "Galaxy S24", brand: "Samsung" },
      })
      await edem.data.createItem({
        collection_id: colId,
        data: { name: "Pixel 8", brand: "Google" },
      })

      const { items, total } = await edem.data.searchItems({
        collection_id: colId,
        query: "iphone",
      })

      expect(total).toBe(1)
      expect(items).toHaveLength(1)
      expect(items[0].data.name).toBe("iPhone 15")
    })

    it("should be case insensitive", async () => {
      const { id: colId } = await edem.data.createCollection({
        name: "Products",
        id: "products",
      })

      await edem.data.createItem({
        collection_id: colId,
        data: { name: "Hello World" },
      })

      const { items } = await edem.data.searchItems({
        collection_id: colId,
        query: "HELLO",
      })

      expect(items).toHaveLength(1)
    })

    it("should support pagination", async () => {
      const { id: colId } = await edem.data.createCollection({
        name: "Products",
        id: "products",
      })

      for (let i = 0; i < 5; i++) {
        await edem.data.createItem({
          collection_id: colId,
          data: { name: `Item test ${i}` },
        })
      }

      const { items, total } = await edem.data.searchItems({
        collection_id: colId,
        query: "test",
        limit: 2,
        offset: 1,
      })

      expect(total).toBe(5)
      expect(items).toHaveLength(2)
    })
  })

  describe("countSearchResults", () => {
    it("should count matching items", async () => {
      const { id: colId } = await edem.data.createCollection({
        name: "Products",
        id: "products",
      })

      await edem.data.createItem({
        collection_id: colId,
        data: { name: "iPhone 15" },
      })
      await edem.data.createItem({
        collection_id: colId,
        data: { name: "iPhone 16" },
      })
      await edem.data.createItem({
        collection_id: colId,
        data: { name: "Galaxy S24" },
      })

      const { count } = await edem.data.countSearchResults({
        collection_id: colId,
        query: "iphone",
      })

      expect(count).toBe(2)
    })
  })

  describe("applyManifest singleton", () => {
    it("should create singleton item with field defaults", async () => {
      const result = await edem.data.applyManifest({
        manifest: {
          collections: [
            {
              id: "settings",
              name: "Settings",
              singleton: true,
              fields: [
                { name: "theme", type: "string", default: "light" },
                { name: "notifications", type: "boolean", default: true },
                { name: "count", type: "number", default: 0 },
              ],
            },
          ],
        },
      })

      expect(result.created).toEqual(["settings"])

      const { items } = await edem.data.queryItems({ collection_id: "settings" })
      expect(items).toHaveLength(1)
      expect(items[0].data.theme).toBe("light")
      expect(items[0].data.notifications).toBe(true)
      expect(items[0].data.count).toBe(0)
    })

    it("should not create duplicate singleton item on re-apply", async () => {
      const manifest = {
        collections: [
          {
            id: "settings",
            name: "Settings",
            singleton: true,
            fields: [{ name: "theme", type: "string" as const, default: "dark" }],
          },
        ],
      }

      await edem.data.applyManifest({ manifest })
      await edem.data.applyManifest({ manifest })

      const { items } = await edem.data.queryItems({ collection_id: "settings" })
      expect(items).toHaveLength(1)
    })

    it("should not create items for non-singleton collections", async () => {
      await edem.data.applyManifest({
        manifest: {
          collections: [
            {
              id: "posts",
              name: "Posts",
              fields: [{ name: "title", type: "string" }],
            },
          ],
        },
      })

      const { items } = await edem.data.queryItems({ collection_id: "posts" })
      expect(items).toHaveLength(0)
    })

    it("should create singleton with empty data when no field defaults", async () => {
      await edem.data.applyManifest({
        manifest: {
          collections: [
            {
              id: "app_state",
              name: "App State",
              singleton: true,
              fields: [
                { name: "window_frame", type: "json" },
                { name: "locale", type: "string" },
              ],
            },
          ],
        },
      })

      const { items } = await edem.data.queryItems({ collection_id: "app_state" })
      expect(items).toHaveLength(1)
      expect(items[0].data).toEqual({})
    })

    it("should emit itemCreated when bootstrapping singleton", async () => {
      const events: string[] = []
      edem.data.itemCreated(({ event }) => {
        if (event.collection_id === "settings") {
          events.push("created")
        }
      })

      await edem.data.applyManifest({
        manifest: {
          collections: [
            {
              id: "settings",
              name: "Settings",
              singleton: true,
              fields: [{ name: "theme", type: "string", default: "dark" }],
            },
          ],
        },
      })

      expect(events).toEqual(["created"])
    })

    it("should backfill default into existing singleton when adding new field", async () => {
      await edem.data.applyManifest({
        manifest: {
          collections: [
            {
              id: "settings",
              name: "Settings",
              singleton: true,
              fields: [{ name: "theme", type: "string", default: "dark" }],
            },
          ],
        },
      })

      await edem.data.updateSingleton({
        collection_id: "settings",
        data: { theme: "light" },
      })

      await edem.data.applyManifest({
        manifest: {
          collections: [
            {
              id: "settings",
              name: "Settings",
              singleton: true,
              fields: [
                { name: "theme", type: "string", default: "dark" },
                { name: "lang", type: "string", default: "en" },
              ],
            },
          ],
        },
      })

      const { item } = await edem.data.getSingleton({ collection_id: "settings" })
      expect(item?.data.theme).toBe("light")
      expect(item?.data.lang).toBe("en")
    })

    it("should not overwrite existing value when backfilling new field", async () => {
      await edem.data.applyManifest({
        manifest: {
          collections: [
            {
              id: "settings",
              name: "Settings",
              singleton: true,
              fields: [{ name: "theme", type: "string" }],
            },
          ],
        },
      })

      await edem.data.updateSingleton({
        collection_id: "settings",
        data: { lang: "ru" },
      })

      await edem.data.applyManifest({
        manifest: {
          collections: [
            {
              id: "settings",
              name: "Settings",
              singleton: true,
              fields: [
                { name: "theme", type: "string" },
                { name: "lang", type: "string", default: "en" },
              ],
            },
          ],
        },
      })

      const { item } = await edem.data.getSingleton({ collection_id: "settings" })
      expect(item?.data.lang).toBe("ru")
    })

    it("should backfill json field default into existing singleton", async () => {
      await edem.data.applyManifest({
        manifest: {
          collections: [
            {
              id: "app",
              name: "App",
              singleton: true,
              fields: [{ name: "locale", type: "string" }],
            },
          ],
        },
      })

      await edem.data.applyManifest({
        manifest: {
          collections: [
            {
              id: "app",
              name: "App",
              singleton: true,
              fields: [
                { name: "locale", type: "string" },
                {
                  name: "locales",
                  type: "json",
                  default: [
                    { value: "en", label: "English" },
                    { value: "ru", label: "Russian" },
                  ],
                },
              ],
            },
          ],
        },
      })

      const { item } = await edem.data.getSingleton({ collection_id: "app" })
      expect(item?.data.locales).toEqual([
        { value: "en", label: "English" },
        { value: "ru", label: "Russian" },
      ])
    })
  })

  describe("getSingleton", () => {
    it("should return singleton item", async () => {
      await edem.data.applyManifest({
        manifest: {
          collections: [
            {
              id: "settings",
              name: "Settings",
              singleton: true,
              fields: [{ name: "theme", type: "string", default: "dark" }],
            },
          ],
        },
      })

      const { item } = await edem.data.getSingleton({ collection_id: "settings" })
      expect(item).not.toBeNull()
      expect(item?.data.theme).toBe("dark")
    })

    it("should return null for empty collection", async () => {
      await edem.data.createCollection({
        id: "posts",
        name: "Posts",
      })

      const { item } = await edem.data.getSingleton({ collection_id: "posts" })
      expect(item).toBeNull()
    })

    it("should throw for non-existent collection", async () => {
      await expect(edem.data.getSingleton({ collection_id: "non-existent" })).rejects.toThrow(
        "not found",
      )
    })
  })

  describe("updateSingleton", () => {
    it("should update singleton item", async () => {
      await edem.data.applyManifest({
        manifest: {
          collections: [
            {
              id: "settings",
              name: "Settings",
              singleton: true,
              fields: [{ name: "theme", type: "string", default: "dark" }],
            },
          ],
        },
      })

      await edem.data.updateSingleton({
        collection_id: "settings",
        data: { theme: "light" },
      })

      const { item } = await edem.data.getSingleton({ collection_id: "settings" })
      expect(item?.data.theme).toBe("light")
    })

    it("should emit itemUpdated", async () => {
      await edem.data.applyManifest({
        manifest: {
          collections: [
            {
              id: "settings",
              name: "Settings",
              singleton: true,
              fields: [{ name: "theme", type: "string", default: "dark" }],
            },
          ],
        },
      })

      const events: string[] = []
      edem.data.itemUpdated(({ event }) => {
        if (event.collection_id === "settings") {
          events.push("updated")
        }
      })

      await edem.data.updateSingleton({
        collection_id: "settings",
        data: { theme: "light" },
      })

      expect(events).toEqual(["updated"])
    })

    it("should throw if singleton not bootstrapped", async () => {
      await edem.data.createCollection({
        id: "settings",
        name: "Settings",
      })

      await expect(
        edem.data.updateSingleton({
          collection_id: "settings",
          data: { theme: "light" },
        }),
      ).rejects.toThrow("not found")
    })

    it("should validate field types", async () => {
      await edem.data.applyManifest({
        manifest: {
          collections: [
            {
              id: "settings",
              name: "Settings",
              singleton: true,
              fields: [{ name: "count", type: "number" }],
            },
          ],
        },
      })

      await expect(
        edem.data.updateSingleton({
          collection_id: "settings",
          data: { count: "not a number" },
        }),
      ).rejects.toThrow('Invalid value for field "count" of type "number"')
    })
  })

  describe("createItem singleton constraint", () => {
    it("should throw when creating item in singleton collection", async () => {
      await edem.data.applyManifest({
        manifest: {
          collections: [
            {
              id: "settings",
              name: "Settings",
              singleton: true,
              fields: [{ name: "theme", type: "string" }],
            },
          ],
        },
      })

      await expect(
        edem.data.createItem({
          collection_id: "settings",
          data: { theme: "light" },
        }),
      ).rejects.toThrow("Cannot create item in singleton collection")
    })

    it("should allow creating item in non-singleton collection", async () => {
      await edem.data.createCollection({
        id: "posts",
        name: "Posts",
      })

      const { id } = await edem.data.createItem({
        collection_id: "posts",
        data: { title: "Test" },
      })

      expect(id).toBeDefined()
    })
  })

  describe("applyManifest field sync", () => {
    it("should add new fields from manifest", async () => {
      await edem.data.createCollection({
        id: "test",
        name: "Test",
        fields: [{ name: "title", type: "string" }],
      })

      await edem.data.applyManifest({
        manifest: {
          collections: [
            {
              id: "test",
              name: "Test",
              fields: [
                { name: "title", type: "string" },
                { name: "description", type: "text" },
              ],
            },
          ],
        },
      })

      const { collection } = await edem.data.getCollection({ collection_id: "test" })
      expect(collection?.fields).toHaveLength(2)
      expect(collection?.fields[1].name).toBe("description")
    })

    it("should sync required from true to false", async () => {
      await edem.data.createCollection({
        id: "test",
        name: "Test",
        fields: [{ name: "email", type: "string", required: true }],
      })

      await expect(edem.data.createItem({ collection_id: "test", data: {} })).rejects.toThrow(
        'Field "email" is required',
      )

      await edem.data.applyManifest({
        manifest: {
          collections: [
            {
              id: "test",
              name: "Test",
              fields: [{ name: "email", type: "string", required: false }],
            },
          ],
        },
      })

      const { id } = await edem.data.createItem({ collection_id: "test", data: {} })
      expect(id).toBeDefined()
    })

    it("should sync required from false to true", async () => {
      await edem.data.createCollection({
        id: "test",
        name: "Test",
        fields: [{ name: "email", type: "string" }],
      })

      const { id: itemId } = await edem.data.createItem({ collection_id: "test", data: {} })
      expect(itemId).toBeDefined()

      await edem.data.applyManifest({
        manifest: {
          collections: [
            {
              id: "test",
              name: "Test",
              fields: [{ name: "email", type: "string", required: true }],
            },
          ],
        },
      })

      await expect(edem.data.createItem({ collection_id: "test", data: {} })).rejects.toThrow(
        'Field "email" is required',
      )
    })

    it("should sync type change", async () => {
      await edem.data.createCollection({
        id: "test",
        name: "Test",
        fields: [{ name: "value", type: "string" }],
      })

      await edem.data.applyManifest({
        manifest: {
          collections: [
            {
              id: "test",
              name: "Test",
              fields: [{ name: "value", type: "number" }],
            },
          ],
        },
      })

      const { id } = await edem.data.createItem({ collection_id: "test", data: { value: 42 } })
      expect(id).toBeDefined()

      await expect(
        edem.data.createItem({ collection_id: "test", data: { value: "not a number" } }),
      ).rejects.toThrow('Invalid value for field "value" of type "number"')
    })

    it("should sync labels on existing field", async () => {
      await edem.data.createCollection({
        id: "test",
        name: "Test",
        fields: [{ name: "title", type: "string" }],
      })

      await edem.data.applyManifest({
        manifest: {
          collections: [
            {
              id: "test",
              name: "Test",
              fields: [{ name: "title", type: "string", labels: { en: "Title", ru: "Заголовок" } }],
            },
          ],
        },
      })

      const { collection } = await edem.data.getCollection({ collection_id: "test" })
      expect(collection?.fields[0].labels).toEqual({ en: "Title", ru: "Заголовок" })
    })

    it("should sync default value", async () => {
      await edem.data.createCollection({
        id: "test",
        name: "Test",
        fields: [{ name: "status", type: "string" }],
      })

      await edem.data.applyManifest({
        manifest: {
          collections: [
            {
              id: "test",
              name: "Test",
              fields: [{ name: "status", type: "string", default: "draft" }],
            },
          ],
        },
      })

      const { collection } = await edem.data.getCollection({ collection_id: "test" })
      expect(collection?.fields[0].default).toBe("draft")
    })

    it("should sync options and meta", async () => {
      await edem.data.createCollection({
        id: "test",
        name: "Test",
        fields: [{ name: "role", type: "string" }],
      })

      await edem.data.applyManifest({
        manifest: {
          collections: [
            {
              id: "test",
              name: "Test",
              fields: [
                {
                  name: "role",
                  type: "string",
                  options: { items: ["admin", "user"] },
                  meta: { sortable: true },
                },
              ],
            },
          ],
        },
      })

      const { collection } = await edem.data.getCollection({ collection_id: "test" })
      expect(collection?.fields[0].options).toEqual({ items: ["admin", "user"] })
      expect(collection?.fields[0].meta).toEqual({ sortable: true })
    })

    it("should sync relation target collection", async () => {
      await edem.data.createCollection({
        id: "posts",
        name: "Posts",
        fields: [{ name: "author", type: "relation", relation: { collection: "users" } }],
      })

      const { collection } = await edem.data.getCollection({ collection_id: "posts" })
      expect(collection?.fields[0].relation).toEqual({ collection: "users" })

      const manifest = await edem.data.getManifest()
      expect(manifest.collections[0]?.fields[0]?.relation).toEqual({ collection: "users" })
    })

    it("should preserve non-relation field options alongside relation config", async () => {
      await edem.data.applyManifest({
        manifest: {
          collections: [
            {
              id: "posts",
              name: "Posts",
              fields: [
                {
                  name: "author",
                  type: "relation",
                  relation: { collection: "users" },
                  options: { mode: "many" },
                },
              ],
            },
          ],
        },
      })

      const { collection } = await edem.data.getCollection({ collection_id: "posts" })
      expect(collection?.fields[0].relation).toEqual({ collection: "users" })
      expect(collection?.fields[0].options).toEqual({ mode: "many" })
    })

    it("should remove fields not in manifest", async () => {
      await edem.data.createCollection({
        id: "test",
        name: "Test",
        fields: [
          { name: "title", type: "string" },
          { name: "legacy", type: "string" },
        ],
      })

      await edem.data.createItem({
        collection_id: "test",
        data: { title: "Hello", legacy: "data" },
      })

      await edem.data.applyManifest({
        manifest: {
          collections: [
            {
              id: "test",
              name: "Test",
              fields: [{ name: "title", type: "string" }],
            },
          ],
        },
      })

      const { collection } = await edem.data.getCollection({ collection_id: "test" })
      expect(collection?.fields).toHaveLength(1)
      expect(collection?.fields[0].name).toBe("title")

      const { items } = await edem.data.queryItems({ collection_id: "test" })
      expect(items).toHaveLength(1)
      expect(items[0].data.title).toBe("Hello")
    })

    it("should be idempotent", async () => {
      const manifest = {
        collections: [
          {
            id: "test",
            name: "Test",
            fields: [
              { name: "title", type: "string" as const, required: true },
              { name: "count", type: "number" as const },
            ],
          },
        ],
      }

      const r1 = await edem.data.applyManifest({ manifest })
      const r2 = await edem.data.applyManifest({ manifest })

      expect(r1.created).toEqual(["test"])
      expect(r2.skipped).toEqual(["test"])
      expect(r2.updated).toHaveLength(0)
    })

    it("should add + update + remove in single apply", async () => {
      await edem.data.createCollection({
        id: "test",
        name: "Test",
        fields: [
          { name: "keep", type: "string", required: true },
          { name: "remove", type: "string" },
        ],
      })

      await edem.data.applyManifest({
        manifest: {
          collections: [
            {
              id: "test",
              name: "Test",
              fields: [
                { name: "keep", type: "string", required: false },
                { name: "added", type: "json" },
              ],
            },
          ],
        },
      })

      const { collection } = await edem.data.getCollection({ collection_id: "test" })
      expect(collection?.fields).toHaveLength(2)

      const names = collection?.fields.map((f) => f.name).sort()
      expect(names).toEqual(["added", "keep"])

      const keepField = collection?.fields.find((f) => f.name === "keep")
      expect(keepField?.required).toBe(false)
    })

    it("should backfill singleton defaults on new fields", async () => {
      await edem.data.applyManifest({
        manifest: {
          collections: [
            {
              id: "settings",
              name: "Settings",
              singleton: true,
              fields: [{ name: "theme", type: "string", default: "dark" }],
            },
          ],
        },
      })

      await edem.data.applyManifest({
        manifest: {
          collections: [
            {
              id: "settings",
              name: "Settings",
              singleton: true,
              fields: [
                { name: "theme", type: "string", default: "dark" },
                { name: "lang", type: "string", default: "en" },
              ],
            },
          ],
        },
      })

      const { item } = await edem.data.getSingleton({ collection_id: "settings" })
      expect(item?.data.theme).toBe("dark")
      expect(item?.data.lang).toBe("en")
    })

    it("should not overwrite existing singleton value when backfilling", async () => {
      await edem.data.applyManifest({
        manifest: {
          collections: [
            {
              id: "settings",
              name: "Settings",
              singleton: true,
              fields: [{ name: "theme", type: "string", default: "dark" }],
            },
          ],
        },
      })

      await edem.data.updateSingleton({
        collection_id: "settings",
        data: { theme: "light" },
      })

      await edem.data.applyManifest({
        manifest: {
          collections: [
            {
              id: "settings",
              name: "Settings",
              singleton: true,
              fields: [
                { name: "theme", type: "string", default: "dark" },
                { name: "lang", type: "string", default: "en" },
              ],
            },
          ],
        },
      })

      const { item } = await edem.data.getSingleton({ collection_id: "settings" })
      expect(item?.data.theme).toBe("light")
      expect(item?.data.lang).toBe("en")
    })

    it("should preserve existing item data when removing field", async () => {
      await edem.data.createCollection({
        id: "test",
        name: "Test",
        fields: [
          { name: "title", type: "string" },
          { name: "extra", type: "string" },
        ],
      })

      await edem.data.createItem({
        collection_id: "test",
        data: { title: "Hello", extra: "preserved" },
      })

      await edem.data.applyManifest({
        manifest: {
          collections: [
            {
              id: "test",
              name: "Test",
              fields: [{ name: "title", type: "string" }],
            },
          ],
        },
      })

      const { items } = await edem.data.queryItems({ collection_id: "test" })
      expect(items[0].data.title).toBe("Hello")
      expect(items[0].data.extra).toBe("preserved")
    })
  })
})
