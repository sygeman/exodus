import { describe, it, expect, beforeEach } from "bun:test"
import { createEdem } from "@exodus/edem-core"
import { dataModule } from "./module"

describe("data module", () => {
  let edem: ReturnType<typeof createEdem<[typeof dataModule]>>
  let projectId: string

  beforeEach(async () => {
    edem = createEdem([dataModule])
    const project = await edem.data.createProject({ name: "Test Project" })
    projectId = project.id
  })

  describe("createCollection", () => {
    it("should create a collection and return id", async () => {
      const result = await edem.data.createCollection({
        project_id: projectId,
        name: "Projects",
        slug: "projects",
        fields: [],
      })
      expect(result.id).toBeDefined()
    })

    it("should be retrievable via getCollection", async () => {
      const { id } = await edem.data.createCollection({
        project_id: projectId,
        name: "Projects",
        slug: "projects",
      })
      const { collection } = await edem.data.getCollection({ collection_id: id })
      expect(collection).not.toBeNull()
      expect(collection?.name).toBe("Projects")
      expect(collection?.slug).toBe("projects")
    })

    it("should appear in listCollections", async () => {
      await edem.data.createCollection({
        project_id: projectId,
        name: "Projects",
        slug: "projects",
      })
      const { collections } = await edem.data.listCollections({ project_id: projectId })
      expect(collections).toHaveLength(1)
      expect(collections[0].slug).toBe("projects")
    })
  })

  describe("createItem", () => {
    it("should create an item and return id", async () => {
      const { id: colId } = await edem.data.createCollection({
        project_id: projectId,
        name: "Test",
        slug: "test",
      })
      const result = await edem.data.createItem({
        collection_id: colId,
        data: { title: "Test Project" },
      })
      expect(result.id).toBeDefined()
    })

    it("should be retrievable via queryItems", async () => {
      const { id: colId } = await edem.data.createCollection({
        project_id: projectId,
        name: "Test",
        slug: "test",
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
        project_id: projectId,
        name: "Test",
        slug: "test",
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
        project_id: projectId,
        name: "Test",
        slug: "test",
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
        project_id: projectId,
        name: "Test",
        slug: "test",
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
        project_id: projectId,
        name: "Test",
        slug: "test",
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
        project_id: projectId,
        name: "Test",
        slug: "test",
      })

      await edem.data.deleteCollection({ collection_id: id })

      const { collections } = await edem.data.listCollections({ project_id: projectId })
      expect(collections).toHaveLength(0)
    })
  })

  describe("updateCollection", () => {
    it("should update collection name and slug", async () => {
      const { id } = await edem.data.createCollection({
        project_id: projectId,
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
      const { id } = await edem.data.createCollection({
        project_id: projectId,
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
        project_id: projectId,
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
      const { id: colId } = await edem.data.createCollection({
        project_id: projectId,
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
      await expect(
        edem.data.updateItem({
          item_id: "non-existent",
          data: { title: "test" },
        }),
      ).rejects.toThrow("not found")
    })

    it("should validate field types on update", async () => {
      const { id: colId } = await edem.data.createCollection({
        project_id: projectId,
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
  })

  describe("deleteItem", () => {
    it("should throw on non-existent item", async () => {
      await expect(edem.data.deleteItem({ item_id: "non-existent" })).rejects.toThrow("not found")
    })
  })

  describe("queryItems", () => {
    it("should filter items by data", async () => {
      const { id: colId } = await edem.data.createCollection({
        project_id: projectId,
        name: "Test",
        slug: "test",
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
        project_id: projectId,
        name: "Test",
        slug: "test",
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
        project_id: projectId,
        name: "Test",
        slug: "test",
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
        project_id: projectId,
        name: "Test",
        slug: "test",
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
        project_id: projectId,
        name: "Test",
        slug: "test",
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
        project_id: projectId,
        name: "Test",
        slug: "test",
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
        project_id: projectId,
        name: "Test",
        slug: "test",
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
        project_id: projectId,
        name: "Test",
        slug: "test",
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
        project_id: projectId,
        name: "Test",
        slug: "test",
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
        project_id: projectId,
        name: "Test",
        slug: "test",
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
        project_id: projectId,
        name: "Test",
        slug: "test",
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
        project_id: projectId,
        name: "Test",
        slug: "test",
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
        project_id: projectId,
        name: "Test",
        slug: "test",
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
        project_id: projectId,
        name: "Test",
        slug: "test",
        fields: [{ id: "1", collection_id: "", name: "title", type: "string" }],
      })

      await edem.data.createItem({ collection_id: colId, data: { title: "Old Item" } })

      await edem.data.updateCollection({
        collection_id: colId,
        fields: [{ id: "2", collection_id: colId, name: "name", type: "string" }],
      })

      const { items } = await edem.data.queryItems({ collection_id: colId })
      expect(items).toHaveLength(1)
      expect(items[0].data.title).toBe("Old Item")
    })

    it("should not break queries when fields are added", async () => {
      const { id: colId } = await edem.data.createCollection({
        project_id: projectId,
        name: "Test",
        slug: "test",
        fields: [{ id: "1", collection_id: "", name: "title", type: "string" }],
      })

      await edem.data.createItem({ collection_id: colId, data: { title: "Old Item" } })

      await edem.data.updateCollection({
        collection_id: colId,
        fields: [
          { id: "1", collection_id: colId, name: "title", type: "string" },
          { id: "2", collection_id: colId, name: "description", type: "text" },
        ],
      })

      const { items } = await edem.data.queryItems({ collection_id: colId })
      expect(items).toHaveLength(1)
      expect(items[0].data.title).toBe("Old Item")
    })

    it("should allow creating items with new fields after schema change", async () => {
      const { id: colId } = await edem.data.createCollection({
        project_id: projectId,
        name: "Test",
        slug: "test",
        fields: [{ id: "1", collection_id: "", name: "title", type: "string" }],
      })

      await edem.data.updateCollection({
        collection_id: colId,
        fields: [
          { id: "1", collection_id: colId, name: "title", type: "string" },
          { id: "2", collection_id: colId, name: "description", type: "text" },
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
        project_id: projectId,
        name: "Test",
        slug: "test",
        fields: [{ id: "1", collection_id: "", name: "title", type: "string" }],
      })

      await edem.data.createItem({ collection_id: colId, data: { title: "Old Item" } })

      await edem.data.updateCollection({
        collection_id: colId,
        fields: [
          { id: "1", collection_id: colId, name: "title", type: "string" },
          {
            id: "2",
            collection_id: colId,
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
        project_id: projectId,
        name: "Test",
        slug: "test",
        fields: [{ id: "1", collection_id: "", name: "title", type: "string" }],
      })

      await edem.data.updateCollection({
        collection_id: colId,
        fields: [
          { id: "1", collection_id: colId, name: "title", type: "string" },
          { id: "2", collection_id: colId, name: "description", type: "text" },
        ],
      })

      const { collection } = await edem.data.getCollection({ collection_id: colId })
      expect(collection?.schema_version).toBe(1)
    })

    it("should keep old items queryable after field type change", async () => {
      const { id: colId } = await edem.data.createCollection({
        project_id: projectId,
        name: "Test",
        slug: "test",
        fields: [{ id: "1", collection_id: "", name: "value", type: "string" }],
      })

      await edem.data.createItem({ collection_id: colId, data: { value: "old text" } })

      await edem.data.updateCollection({
        collection_id: colId,
        fields: [{ id: "2", collection_id: colId, name: "value", type: "number" }],
      })

      await edem.data.createItem({ collection_id: colId, data: { value: 42 } })

      const { items } = await edem.data.queryItems({ collection_id: colId })
      expect(items).toHaveLength(2)
    })
  })
})
