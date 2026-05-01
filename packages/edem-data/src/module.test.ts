import { describe, it, expect } from "bun:test"
import { createEdem } from "@exodus/edem-core"
import { dataModule } from "./module"

describe("data module", () => {
  it("should create and use data module", async () => {
    const edem = createEdem([dataModule])

    const createResult = await edem.data.createCollection({
      name: "Projects",
      slug: "projects",
      fields: [],
    })
    expect(createResult.id).toBeDefined()

    const { collection } = await edem.data.getCollection({
      collection_id: createResult.id,
    })
    expect(collection).not.toBeNull()
    expect(collection?.name).toBe("Projects")

    const { collections } = await edem.data.listCollections()
    expect(collections.length).toBe(1)
    expect(collections[0].slug).toBe("projects")

    const itemResult = await edem.data.createItem({
      collection_id: createResult.id,
      data: { title: "Test Project" },
    })
    expect(itemResult.id).toBeDefined()

    const { items } = await edem.data.queryItems({
      collection_id: createResult.id,
    })
    expect(items.length).toBe(1)
    expect(items[0].data.title).toBe("Test Project")

    await edem.data.updateItem({
      item_id: itemResult.id,
      data: { title: "Updated Project" },
    })

    const { item } = await edem.data.getItem({
      item_id: itemResult.id,
    })
    expect(item?.data.title).toBe("Updated Project")

    await edem.data.deleteItem({
      item_id: itemResult.id,
    })

    const { item: deletedItem } = await edem.data.getItem({
      item_id: itemResult.id,
    })
    expect(deletedItem).toBeNull()

    await edem.data.deleteCollection({
      collection_id: createResult.id,
    })

    const { collections: empty } = await edem.data.listCollections()
    expect(empty.length).toBe(0)
  })

  it("should emit events on mutations", async () => {
    const edem = createEdem([dataModule])

    const events: string[] = []
    edem.data.collectionCreated(async ({ event }) => {
      events.push(`created:${event.name}`)
    })

    edem.data.itemCreated(async ({ event }) => {
      events.push(`itemCreated:${event.id}`)
    })

    await edem.data.createCollection({
      name: "Test",
      slug: "test",
    })

    expect(events).toContain("created:Test")
  })

  it("should reject invalid field values", async () => {
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
