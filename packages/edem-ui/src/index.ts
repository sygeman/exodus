/**
 * Edem UI Engine — primitives, layouts, data binding, and theme system.
 *
 * Mock implementation for integration testing.
 */

import { type Edem } from "@exodus/edem-core"

export interface Page {
  id: string
  name: string
  route: string
}

export interface Component {
  id: string
  type: string
  props: Record<string, unknown>
}

/**
 * Create the UI module.
 *
 * Events:
 *   Commands:  ui:create_page, ui:get_page, ui:render_page
 *   Facts:     ui:page_created, ui:page_updated
 *   Errors:    ui:error
 */
export function createUiModule(edem: Edem) {
  const pages = new Map<string, Page>()

  // Create page
  edem.handle("ui:create_page", (ctx) => {
    const { name, route } = ctx.payload as { name: string; route: string }
    const id = crypto.randomUUID()
    const page: Page = { id, name, route }
    pages.set(id, page)

    edem.emit("ui:page_created", { pageId: id, name, route })

    return { pageId: id }
  })

  // Get page
  edem.handle("ui:get_page", (ctx) => {
    const { pageId } = ctx.payload as { pageId: string }
    const page = pages.get(pageId)
    if (!page) throw new Error(`Page ${pageId} not found`)
    return page
  })

  // Render page (binds to data)
  edem.handle("ui:render_page", async (ctx) => {
    const { pageId, collectionId } = ctx.payload as {
      pageId: string
      collectionId: string
    }
    const page = pages.get(pageId)
    if (!page) throw new Error(`Page ${pageId} not found`)

    // Query data module for items
    const result = (await edem.request("data:query_items", { collectionId })) as {
      items: unknown[]
    }

    return {
      page,
      items: result.items,
    }
  })

  // Listen to data changes to invalidate UI
  edem.on("data:item_created", (ctx) => {
    edem.emit("ui:invalidate", {
      reason: "data_changed",
      collectionId: (ctx.payload as { collectionId: string }).collectionId,
    })
  })

  // === Public API ===
  edem.ui = {
    createPage: (params: { name: string; route: string }) => edem.request("ui:create_page", params),
    getPage: (pageId: string) => edem.request("ui:get_page", { pageId }),
    renderPage: (params: { pageId: string; collectionId: string }) =>
      edem.request("ui:render_page", params),
  }
}
