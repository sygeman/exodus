/**
 * Edem Data Engine — collections, fields, items, query builder, and file storage.
 *
 * Mock implementation for integration testing.
 * Will be replaced with full implementation based on tauri-plugin-data reference.
 */

import { type Edem } from "@exodus/edem-core"

export interface DataItem {
  id: string
  collectionId: string
  data: unknown
}

export interface DataCollection {
  id: string
  projectId: string
  slug: string
  name: string
}

export interface DataProject {
  id: string
  slug: string
  name: string
}

/**
 * Create the Data module.
 *
 * Events:
 *   Commands:  data:create_item, data:get_item, data:query_items
 *              data:create_collection, data:get_collection
 *              data:create_project, data:get_project
 *   Facts:     data:item_created, data:collection_created, data:project_created
 *   Errors:    data:error
 */
export function createDataModule(edem: Edem) {
  const items = new Map<string, DataItem>()
  const collections = new Map<string, DataCollection>()
  const projects = new Map<string, DataProject>()

  // === Projects ===
  edem.handle("data:create_project", (ctx) => {
    const { slug, name } = ctx.payload as { slug: string; name: string }
    const id = crypto.randomUUID()
    const project: DataProject = { id, slug, name }
    projects.set(id, project)

    edem.emit("data:project_created", { projectId: id, slug, name })

    return { projectId: id }
  })

  edem.handle("data:get_project", (ctx) => {
    const { projectId } = ctx.payload as { projectId: string }
    const project = projects.get(projectId)
    if (!project) throw new Error(`Project ${projectId} not found`)
    return project
  })

  // === Collections ===
  edem.handle("data:create_collection", (ctx) => {
    const { projectId, slug, name } = ctx.payload as {
      projectId: string
      slug: string
      name: string
    }
    const id = crypto.randomUUID()
    const collection: DataCollection = { id, projectId, slug, name }
    collections.set(id, collection)

    edem.emit("data:collection_created", { collectionId: id, projectId, slug, name })

    return { collectionId: id }
  })

  edem.handle("data:get_collection", (ctx) => {
    const { collectionId } = ctx.payload as { collectionId: string }
    const collection = collections.get(collectionId)
    if (!collection) throw new Error(`Collection ${collectionId} not found`)
    return collection
  })

  // === Items ===
  edem.handle("data:create_item", (ctx) => {
    const { collectionId, data } = ctx.payload as {
      collectionId: string
      data: unknown
    }
    const id = crypto.randomUUID()
    const item: DataItem = { id, collectionId, data }
    items.set(id, item)

    edem.emit("data:item_created", { itemId: id, collectionId, data })

    return { itemId: id }
  })

  edem.handle("data:get_item", (ctx) => {
    const { itemId } = ctx.payload as { itemId: string }
    const item = items.get(itemId)
    if (!item) throw new Error(`Item ${itemId} not found`)
    return item
  })

  edem.handle("data:query_items", (ctx) => {
    const { collectionId } = ctx.payload as { collectionId: string }
    const result = Array.from(items.values()).filter((i) => i.collectionId === collectionId)
    return { items: result, total: result.length }
  })

  // === Cross-module: listen to flow completion for metrics ===
  edem.on("flows:run_completed", (ctx) => {
    const { flowId, status } = ctx.payload as { flowId: string; status: string }
    edem.emit("metrics:record", { event: "flow_completed", flowId, status })
  })

  // === Public API ===
  edem.data = {
    createCollection: (params: { projectId: string; slug: string; name: string }) =>
      edem.request("data:create_collection", params),
    getCollection: (collectionId: string) => edem.request("data:get_collection", { collectionId }),
    createItem: (params: { collectionId: string; data: unknown }) =>
      edem.request("data:create_item", params),
    getItem: (itemId: string) => edem.request("data:get_item", { itemId }),
    queryItems: (collectionId: string) => edem.request("data:query_items", { collectionId }),
    createProject: (params: { slug: string; name: string }) =>
      edem.request("data:create_project", params),
    getProject: (projectId: string) => edem.request("data:get_project", { projectId }),
  }
}
