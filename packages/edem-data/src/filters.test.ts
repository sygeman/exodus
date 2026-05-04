import { describe, it, expect, beforeEach } from "bun:test"
import { createEdem } from "@exodus/edem-core"
import { dataModule } from "./module"
import { matchFilter, sortItems } from "./filters"

describe("matchFilter", () => {
  const data = { name: "Alice", age: 30, status: "active", tag: "dev" }

  describe("_eq", () => {
    it("should match equal values", () => {
      expect(matchFilter(data, { name: { _eq: "Alice" } })).toBe(true)
    })

    it("should reject non-equal values", () => {
      expect(matchFilter(data, { name: { _eq: "Bob" } })).toBe(false)
    })
  })

  describe("_neq", () => {
    it("should match non-equal values", () => {
      expect(matchFilter(data, { name: { _neq: "Bob" } })).toBe(true)
    })

    it("should reject equal values", () => {
      expect(matchFilter(data, { name: { _neq: "Alice" } })).toBe(false)
    })
  })

  describe("_gt", () => {
    it("should match greater values", () => {
      expect(matchFilter(data, { age: { _gt: 20 } })).toBe(true)
    })

    it("should reject equal or lesser values", () => {
      expect(matchFilter(data, { age: { _gt: 30 } })).toBe(false)
      expect(matchFilter(data, { age: { _gt: 40 } })).toBe(false)
    })

    it("should reject non-number values", () => {
      expect(matchFilter(data, { name: { _gt: "a" } })).toBe(false)
    })
  })

  describe("_gte", () => {
    it("should match greater or equal values", () => {
      expect(matchFilter(data, { age: { _gte: 30 } })).toBe(true)
      expect(matchFilter(data, { age: { _gte: 20 } })).toBe(true)
    })

    it("should reject lesser values", () => {
      expect(matchFilter(data, { age: { _gte: 40 } })).toBe(false)
    })
  })

  describe("_lt", () => {
    it("should match lesser values", () => {
      expect(matchFilter(data, { age: { _lt: 40 } })).toBe(true)
    })

    it("should reject equal or greater values", () => {
      expect(matchFilter(data, { age: { _lt: 30 } })).toBe(false)
      expect(matchFilter(data, { age: { _lt: 20 } })).toBe(false)
    })
  })

  describe("_lte", () => {
    it("should match lesser or equal values", () => {
      expect(matchFilter(data, { age: { _lte: 30 } })).toBe(true)
      expect(matchFilter(data, { age: { _lte: 40 } })).toBe(true)
    })

    it("should reject greater values", () => {
      expect(matchFilter(data, { age: { _lte: 20 } })).toBe(false)
    })
  })

  describe("_contains", () => {
    it("should match contained substrings", () => {
      expect(matchFilter(data, { name: { _contains: "lic" } })).toBe(true)
    })

    it("should reject non-contained substrings", () => {
      expect(matchFilter(data, { name: { _contains: "bob" } })).toBe(false)
    })

    it("should reject non-string values", () => {
      expect(matchFilter(data, { age: { _contains: "3" } })).toBe(false)
    })
  })

  describe("_starts_with", () => {
    it("should match string prefixes", () => {
      expect(matchFilter(data, { name: { _starts_with: "Al" } })).toBe(true)
    })

    it("should reject non-matching prefixes", () => {
      expect(matchFilter(data, { name: { _starts_with: "Bo" } })).toBe(false)
    })
  })

  describe("_ends_with", () => {
    it("should match string suffixes", () => {
      expect(matchFilter(data, { name: { _ends_with: "ce" } })).toBe(true)
    })

    it("should reject non-matching suffixes", () => {
      expect(matchFilter(data, { name: { _ends_with: "ob" } })).toBe(false)
    })
  })

  describe("_in", () => {
    it("should match values in array", () => {
      expect(matchFilter(data, { status: { _in: ["active", "pending"] } })).toBe(true)
    })

    it("should reject values not in array", () => {
      expect(matchFilter(data, { status: { _in: ["draft", "archived"] } })).toBe(false)
    })

    it("should reject non-array expected", () => {
      expect(matchFilter(data, { status: { _in: "active" as any } })).toBe(false)
    })

    it("should reject undefined value", () => {
      expect(matchFilter(data, { missing: { _in: ["a", "b"] } })).toBe(false)
    })
  })

  describe("_between", () => {
    it("should match values within range (inclusive)", () => {
      expect(matchFilter(data, { age: { _between: [20, 40] } })).toBe(true)
      expect(matchFilter(data, { age: { _between: [30, 30] } })).toBe(true)
    })

    it("should reject values outside range", () => {
      expect(matchFilter(data, { age: { _between: [31, 40] } })).toBe(false)
    })

    it("should reject invalid range spec", () => {
      expect(matchFilter(data, { age: { _between: [30] } })).toBe(false)
      expect(matchFilter(data, { age: { _between: "bad" as any } })).toBe(false)
      expect(matchFilter(data, { age: { _between: [30, 40, 50] } })).toBe(false)
      expect(matchFilter(data, { age: { _between: [] } })).toBe(false)
    })
  })

  describe("multiple conditions on same field", () => {
    it("should require all conditions to pass", () => {
      expect(matchFilter(data, { age: { _gte: 25, _lte: 35 } })).toBe(true)
      expect(matchFilter(data, { age: { _gte: 35, _lte: 40 } })).toBe(false)
    })
  })

  describe("multiple fields", () => {
    it("should require all fields to match", () => {
      expect(matchFilter(data, { name: { _eq: "Alice" }, age: { _gt: 25 } })).toBe(true)
      expect(matchFilter(data, { name: { _eq: "Bob" }, age: { _gt: 25 } })).toBe(false)
    })
  })

  describe("_and", () => {
    it("should match when all sub-filters match", () => {
      expect(
        matchFilter(data, { _and: [{ age: { _gt: 25 } }, { status: { _eq: "active" } }] }),
      ).toBe(true)
    })

    it("should reject when any sub-filter fails", () => {
      expect(
        matchFilter(data, { _and: [{ age: { _gt: 25 } }, { status: { _eq: "draft" } }] }),
      ).toBe(false)
    })
  })

  describe("_or", () => {
    it("should match when any sub-filter matches", () => {
      expect(matchFilter(data, { _or: [{ name: { _eq: "Bob" } }, { age: { _eq: 30 } }] })).toBe(
        true,
      )
    })

    it("should reject when all sub-filters fail", () => {
      expect(matchFilter(data, { _or: [{ name: { _eq: "Bob" } }, { age: { _eq: 99 } }] })).toBe(
        false,
      )
    })
  })

  describe("_and with other fields", () => {
    it("should require both _and and field conditions to pass", () => {
      expect(
        matchFilter(data, {
          _and: [{ age: { _gt: 25 } }, { status: { _eq: "active" } }],
          name: { _eq: "Alice" },
        }),
      ).toBe(true)
    })

    it("should fail when _and passes but field condition fails", () => {
      expect(
        matchFilter(data, {
          _and: [{ age: { _gt: 25 } }, { status: { _eq: "active" } }],
          name: { _eq: "Bob" },
        }),
      ).toBe(false)
    })

    it("should fail when field passes but _and fails", () => {
      expect(
        matchFilter(data, {
          _and: [{ age: { _gt: 50 } }, { status: { _eq: "active" } }],
          name: { _eq: "Alice" },
        }),
      ).toBe(false)
    })
  })

  describe("_or with other fields", () => {
    it("should require both _or and field conditions to pass", () => {
      expect(
        matchFilter(data, {
          _or: [{ name: { _eq: "Bob" } }, { age: { _eq: 30 } }],
          status: { _eq: "active" },
        }),
      ).toBe(true)
    })

    it("should fail when _or passes but field condition fails", () => {
      expect(
        matchFilter(data, {
          _or: [{ name: { _eq: "Bob" } }, { age: { _eq: 30 } }],
          status: { _eq: "draft" },
        }),
      ).toBe(false)
    })
  })

  describe("nested _and/_or", () => {
    it("should handle nested logical operators", () => {
      expect(
        matchFilter(data, {
          _and: [
            { _or: [{ name: { _eq: "Alice" } }, { name: { _eq: "Bob" } }] },
            { age: { _gte: 30 } },
          ],
        }),
      ).toBe(true)
    })
  })

  describe("unknown operator", () => {
    it("should reject unknown operator", () => {
      expect(matchFilter(data, { name: { _unknown: "value" } })).toBe(false)
    })

    it("should reject unknown operator even with matching value", () => {
      expect(matchFilter(data, { name: { _foo: "Alice" } })).toBe(false)
    })
  })

  describe("edge cases", () => {
    it("should match with empty filter", () => {
      expect(matchFilter(data, {})).toBe(true)
    })

    it("should not match on missing field", () => {
      expect(matchFilter(data, { missing: { _eq: "value" } })).toBe(false)
    })

    it("should handle null values in data", () => {
      expect(matchFilter({ name: null }, { name: { _eq: null } })).toBe(true)
      expect(matchFilter({ name: null }, { name: { _neq: "x" } })).toBe(true)
    })

    it("should reject null values for string operators", () => {
      expect(matchFilter({ name: null }, { name: { _contains: "x" } })).toBe(false)
      expect(matchFilter({ name: null }, { name: { _starts_with: "x" } })).toBe(false)
      expect(matchFilter({ name: null }, { name: { _ends_with: "x" } })).toBe(false)
    })

    it("should reject null values for number operators", () => {
      expect(matchFilter({ age: null }, { age: { _gt: 0 } })).toBe(false)
      expect(matchFilter({ age: null }, { age: { _gte: 0 } })).toBe(false)
      expect(matchFilter({ age: null }, { age: { _lt: 0 } })).toBe(false)
      expect(matchFilter({ age: null }, { age: { _lte: 0 } })).toBe(false)
      expect(matchFilter({ age: null }, { age: { _between: [0, 10] } })).toBe(false)
    })
  })

  describe("_search", () => {
    it("should match substring in string field", () => {
      expect(matchFilter(data, { _search: "lic" })).toBe(true)
    })

    it("should be case insensitive", () => {
      expect(matchFilter(data, { _search: "ALICE" })).toBe(true)
      expect(matchFilter(data, { _search: "alice" })).toBe(true)
    })

    it("should reject non-matching query", () => {
      expect(matchFilter(data, { _search: "bob" })).toBe(false)
    })

    it("should skip non-string fields", () => {
      expect(matchFilter(data, { _search: "30" })).toBe(false)
    })

    it("should search in nested objects", () => {
      const nested = { profile: { bio: "Hello world" }, name: "Test" }
      expect(matchFilter(nested, { _search: "hello" })).toBe(true)
    })

    it("should match empty string against everything", () => {
      expect(matchFilter(data, { _search: "" })).toBe(true)
    })

    it("should combine with other filters", () => {
      expect(
        matchFilter(data, { _and: [{ _search: "Alice" }, { status: { _eq: "active" } }] }),
      ).toBe(true)
      expect(
        matchFilter(data, { _and: [{ _search: "Alice" }, { status: { _eq: "draft" } }] }),
      ).toBe(false)
    })
  })
})

describe("sortItems", () => {
  const items = [
    { id: "1", collection_id: "c", data: { name: "C", order: 3 }, created_at: 0, updated_at: 0 },
    { id: "2", collection_id: "c", data: { name: "A", order: 1 }, created_at: 0, updated_at: 0 },
    { id: "3", collection_id: "c", data: { name: "B", order: 2 }, created_at: 0, updated_at: 0 },
  ]

  it("should sort ascending by number", () => {
    const sorted = sortItems(items, ["order"])
    expect(sorted.map((i) => i.data.name)).toEqual(["A", "B", "C"])
  })

  it("should sort descending with - prefix", () => {
    const sorted = sortItems(items, ["-order"])
    expect(sorted.map((i) => i.data.name)).toEqual(["C", "B", "A"])
  })

  it("should sort by string", () => {
    const sorted = sortItems(items, ["name"])
    expect(sorted.map((i) => i.data.name)).toEqual(["A", "B", "C"])
  })

  it("should handle null/undefined values", () => {
    const withNull = [
      { id: "1", collection_id: "c", data: { val: 1 }, created_at: 0, updated_at: 0 },
      { id: "2", collection_id: "c", data: { val: null }, created_at: 0, updated_at: 0 },
      { id: "3", collection_id: "c", data: { val: 3 }, created_at: 0, updated_at: 0 },
    ]
    const sorted = sortItems(withNull, ["val"])
    expect(sorted[0].data.val).toBeNull()
    expect(sorted[1].data.val).toBe(1)
    expect(sorted[2].data.val).toBe(3)
  })

  it("should handle multi-field sort", () => {
    const multi = [
      { id: "1", collection_id: "c", data: { group: "A", order: 2 }, created_at: 0, updated_at: 0 },
      { id: "2", collection_id: "c", data: { group: "A", order: 1 }, created_at: 0, updated_at: 0 },
      { id: "3", collection_id: "c", data: { group: "B", order: 1 }, created_at: 0, updated_at: 0 },
    ]
    const sorted = sortItems(multi, ["group", "order"])
    expect(sorted.map((i) => `${i.data.group}:${i.data.order}`)).toEqual(["A:1", "A:2", "B:1"])
  })

  it("should return empty array as-is", () => {
    expect(sortItems([], ["order"])).toEqual([])
  })
})

describe("query language (integration)", () => {
  let edem: ReturnType<typeof createEdem<[typeof dataModule]>>

  beforeEach(async () => {
    edem = createEdem([dataModule])
  })

  it("should filter items with _eq", async () => {
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
