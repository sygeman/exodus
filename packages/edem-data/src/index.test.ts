import { describe, it, expect } from "bun:test"
import { createEdem } from "@exodus/edem-core"
import { dataModule } from "./index"

describe("edem-data module", () => {
  it("should create and use data module", async () => {
    const edem = createEdem([dataModule])

    // Create collection
    const createResult = await edem.data.createCollection({
      name: "Projects",
      slug: "projects",
      fields: [],
    })
    expect(createResult.id).toBeDefined()

    // Get collection
    const { collection } = await edem.data.getCollection({
      collection_id: createResult.id,
    })
    expect(collection).not.toBeNull()
    expect(collection?.name).toBe("Projects")

    // List collections
    const { collections } = await edem.data.listCollections()
    expect(collections.length).toBe(1)
    expect(collections[0].slug).toBe("projects")

    // Create item
    const itemResult = await edem.data.createItem({
      collection_id: createResult.id,
      data: { title: "Test Project" },
    })
    expect(itemResult.id).toBeDefined()

    // Query items
    const { items } = await edem.data.queryItems({
      collection_id: createResult.id,
    })
    expect(items.length).toBe(1)
    expect(items[0].data.title).toBe("Test Project")

    // Update item
    await edem.data.updateItem({
      item_id: itemResult.id,
      data: { title: "Updated Project" },
    })

    const { item } = await edem.data.getItem({
      item_id: itemResult.id,
    })
    expect(item?.data.title).toBe("Updated Project")

    // Delete item
    await edem.data.deleteItem({
      item_id: itemResult.id,
    })

    const { item: deletedItem } = await edem.data.getItem({
      item_id: itemResult.id,
    })
    expect(deletedItem).toBeNull()

    // Delete collection
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
})
