import { describe, expect, it, beforeEach } from "bun:test"
import { createPlatform } from "./index"

describe("Platform — Data", () => {
  let edem: ReturnType<typeof createPlatform>
  let projectId: string

  beforeEach(async () => {
    edem = createPlatform()
    const project = await edem.data.createProject({ name: "Test Project" })
    projectId = project.id
  })

  it("creates a collection and item", async () => {
    const { id } = await edem.data.createCollection({
      project_id: projectId,
      name: "Games",
      slug: "games",
    })
    expect(id).toMatch(/^[0-9a-f-]{36}$/i)

    const item = await edem.data.createItem({
      collection_id: id,
      data: { title: "Elden Ring" },
    })
    expect(item.id).toMatch(/^[0-9a-f-]{36}$/i)
  })

  it("queries items by collection", async () => {
    const { id: colId } = await edem.data.createCollection({
      project_id: projectId,
      name: "Games",
      slug: "games",
    })

    await edem.data.createItem({
      collection_id: colId,
      data: { title: "Elden Ring" },
    })
    await edem.data.createItem({
      collection_id: colId,
      data: { title: "Dark Souls" },
    })

    const { id: moviesId } = await edem.data.createCollection({
      project_id: projectId,
      name: "Movies",
      slug: "movies",
    })
    await edem.data.createItem({
      collection_id: moviesId,
      data: { title: "Inception" },
    })

    const { items, total } = await edem.data.queryItems({
      collection_id: colId,
    })

    expect(total).toBe(2)
    expect(items).toHaveLength(2)
  })

  it("subscribes to events", async () => {
    const names: string[] = []

    edem.data.collectionCreated(async ({ event }) => {
      names.push(event.name)
    })

    await edem.data.createCollection({ project_id: projectId, name: "Games", slug: "games" })
    await edem.data.createCollection({ project_id: projectId, name: "Movies", slug: "movies" })

    expect(names).toEqual(["Games", "Movies"])
  })

  it("updates and deletes items", async () => {
    const { id: colId } = await edem.data.createCollection({
      project_id: projectId,
      name: "Test",
      slug: "test",
    })

    const { id: itemId } = await edem.data.createItem({
      collection_id: colId,
      data: { title: "Original" },
    })

    await edem.data.updateItem({
      item_id: itemId,
      data: { title: "Updated" },
    })

    const { item } = await edem.data.getItem({ item_id: itemId })
    expect(item?.data.title).toBe("Updated")

    await edem.data.deleteItem({ item_id: itemId })

    const { item: deleted } = await edem.data.getItem({ item_id: itemId })
    expect(deleted).toBeNull()
  })
})

// TODO: uncomment when flows/ui/runners/mcp are migrated to createEdemModule
// describe("Platform — Flows", () => { ... })
// describe("Platform — UI", () => { ... })
// describe("Platform — Runners", () => { ... })
// describe("Platform — MCP", () => { ... })
// describe("Platform — Full stack", () => { ... })
