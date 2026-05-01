import { describe, it, expect } from "bun:test"
import { createEdem } from "@exodus/edem-core"
import { dataModule } from "./module"

describe("query language", () => {
  it("should filter items with _eq", async () => {
    const edem = createEdem([dataModule])

    const { id: colId } = await edem.data.createCollection({
      name: "Test",
      slug: "test",
    })

    await edem.data.createItem({ collection_id: colId, data: { status: "published", title: "A" } })
    await edem.data.createItem({ collection_id: colId, data: { status: "draft", title: "B" } })
    await edem.data.createItem({ collection_id: colId, data: { status: "published", title: "C" } })

    const { items, total } = await edem.data.queryItems({
      collection_id: colId,
      filter: { status: { _eq: "published" } },
    })

    expect(total).toBe(2)
    expect(items).toHaveLength(2)
  })

  it("should filter items with _gt and _lt", async () => {
    const edem = createEdem([dataModule])

    const { id: colId } = await edem.data.createCollection({
      name: "Products",
      slug: "products",
    })

    await edem.data.createItem({ collection_id: colId, data: { price: 10 } })
    await edem.data.createItem({ collection_id: colId, data: { price: 25 } })
    await edem.data.createItem({ collection_id: colId, data: { price: 50 } })

    const { items } = await edem.data.queryItems({
      collection_id: colId,
      filter: { price: { _gt: 15, _lt: 40 } },
    })

    expect(items).toHaveLength(1)
    expect(items[0].data.price).toBe(25)
  })

  it("should filter items with _contains", async () => {
    const edem = createEdem([dataModule])

    const { id: colId } = await edem.data.createCollection({
      name: "Posts",
      slug: "posts",
    })

    await edem.data.createItem({ collection_id: colId, data: { title: "Hello World" } })
    await edem.data.createItem({ collection_id: colId, data: { title: "Goodbye World" } })
    await edem.data.createItem({ collection_id: colId, data: { title: "Hello Again" } })

    const { items } = await edem.data.queryItems({
      collection_id: colId,
      filter: { title: { _contains: "Hello" } },
    })

    expect(items).toHaveLength(2)
  })

  it("should filter items with _in", async () => {
    const edem = createEdem([dataModule])

    const { id: colId } = await edem.data.createCollection({
      name: "Items",
      slug: "items",
    })

    await edem.data.createItem({ collection_id: colId, data: { category: "books" } })
    await edem.data.createItem({ collection_id: colId, data: { category: "movies" } })
    await edem.data.createItem({ collection_id: colId, data: { category: "music" } })

    const { items } = await edem.data.queryItems({
      collection_id: colId,
      filter: { category: { _in: ["books", "music"] } },
    })

    expect(items).toHaveLength(2)
  })

  it("should sort items", async () => {
    const edem = createEdem([dataModule])

    const { id: colId } = await edem.data.createCollection({
      name: "Items",
      slug: "items",
    })

    await edem.data.createItem({ collection_id: colId, data: { name: "C", order: 3 } })
    await edem.data.createItem({ collection_id: colId, data: { name: "A", order: 1 } })
    await edem.data.createItem({ collection_id: colId, data: { name: "B", order: 2 } })

    const { items: asc } = await edem.data.queryItems({
      collection_id: colId,
      sort: ["order"],
    })

    expect(asc.map((i) => i.data.name)).toEqual(["A", "B", "C"])

    const { items: desc } = await edem.data.queryItems({
      collection_id: colId,
      sort: ["-order"],
    })

    expect(desc.map((i) => i.data.name)).toEqual(["C", "B", "A"])
  })

  it("should paginate items", async () => {
    const edem = createEdem([dataModule])

    const { id: colId } = await edem.data.createCollection({
      name: "Items",
      slug: "items",
    })

    for (let i = 1; i <= 5; i++) {
      await edem.data.createItem({ collection_id: colId, data: { index: i } })
    }

    const { items: page1, total } = await edem.data.queryItems({
      collection_id: colId,
      limit: 2,
      offset: 0,
    })

    expect(total).toBe(5)
    expect(page1).toHaveLength(2)

    const { items: page2 } = await edem.data.queryItems({
      collection_id: colId,
      limit: 2,
      offset: 2,
    })

    expect(page2).toHaveLength(2)
    expect(page2[0].data.index).toBe(3)
  })

  it("should combine filter, sort, and pagination", async () => {
    const edem = createEdem([dataModule])

    const { id: colId } = await edem.data.createCollection({
      name: "Products",
      slug: "products",
    })

    await edem.data.createItem({
      collection_id: colId,
      data: { name: "A", price: 30, status: "active" },
    })
    await edem.data.createItem({
      collection_id: colId,
      data: { name: "B", price: 10, status: "active" },
    })
    await edem.data.createItem({
      collection_id: colId,
      data: { name: "C", price: 20, status: "draft" },
    })
    await edem.data.createItem({
      collection_id: colId,
      data: { name: "D", price: 40, status: "active" },
    })

    const { items, total } = await edem.data.queryItems({
      collection_id: colId,
      filter: { status: { _eq: "active" } },
      sort: ["price"],
      limit: 2,
      offset: 0,
    })

    expect(total).toBe(3)
    expect(items).toHaveLength(2)
    expect(items[0].data.name).toBe("B")
    expect(items[1].data.name).toBe("A")
  })
})
