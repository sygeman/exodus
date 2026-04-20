/**
 * Edem UI Engine — primitives, layouts, data binding, and theme system.
 *
 * Mock implementation for integration testing.
 */

import { type Evento, type Module, nextDepth } from "@exodus/edem-core"

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
export function createUiModule(): Module {
  const pages = new Map<string, Page>()

  return {
    name: "ui",
    init(evento: Evento) {
      // Create page
      evento.handle("ui:create_page", (ctx) => {
        const { name, route } = ctx.payload as { name: string; route: string }
        const id = crypto.randomUUID()
        const page: Page = { id, name, route }
        pages.set(id, page)

        evento.emit("ui:page_created", { pageId: id, name, route }, nextDepth(ctx.meta))

        return { pageId: id }
      })

      // Get page
      evento.handle("ui:get_page", (ctx) => {
        const { pageId } = ctx.payload as { pageId: string }
        const page = pages.get(pageId)
        if (!page) throw new Error(`Page ${pageId} not found`)
        return page
      })

      // Render page (binds to data)
      evento.handle("ui:render_page", async (ctx) => {
        const { pageId, collectionId } = ctx.payload as {
          pageId: string
          collectionId: string
        }
        const page = pages.get(pageId)
        if (!page) throw new Error(`Page ${pageId} not found`)

        // Query data module for items
        const result = (await evento.request(
          "data:query_items",
          { collectionId },
          nextDepth(ctx.meta),
        )) as { items: unknown[] }

        return {
          page,
          items: result.items,
        }
      })

      // Listen to data changes to invalidate UI
      evento.on("data:item_created", (ctx) => {
        evento.emit(
          "ui:invalidate",
          {
            reason: "data_changed",
            collectionId: (ctx.payload as { collectionId: string }).collectionId,
          },
          nextDepth(ctx.meta),
        )
      })
    },
  }
}
