import { z } from "zod"
import { createEdemModule } from "@exodus/edem-core"

export const pageSchema = z.object({
  id: z.string(),
  name: z.string(),
  route: z.string(),
})

export const componentSchema = z.object({
  id: z.string(),
  type: z.string(),
  props: z.record(z.string(), z.unknown()),
})

export const uiModule = createEdemModule("ui", (module) => {
  return module
    .context(async () => ({
      pages: new Map<string, z.infer<typeof pageSchema>>(),
    }))
    .subscription("pageCreated", {
      output: z.object({
        page_id: z.string(),
        name: z.string(),
        route: z.string(),
      }),
    })
    .subscription("pageUpdated", {
      output: z.object({
        page_id: z.string(),
      }),
    })
    .subscription("invalidate", {
      output: z.object({
        reason: z.string(),
        collection_id: z.string().optional(),
      }),
    })
    .mutation("createPage", {
      input: z.object({
        name: z.string(),
        route: z.string(),
      }),
      output: z.object({
        page_id: z.string(),
      }),
      resolve: async ({ input, ctx, emit }) => {
        const id = crypto.randomUUID()
        const page = { id, name: input.name, route: input.route }
        ctx.pages.set(id, page)
        await emit.pageCreated({ page_id: id, name: input.name, route: input.route })
        return { page_id: id }
      },
    })
    .query("getPage", {
      input: z.object({
        page_id: z.string(),
      }),
      output: z.object({
        page: pageSchema.nullable(),
      }),
      resolve: async ({ input, ctx }) => {
        const page = ctx.pages.get(input.page_id) ?? null
        return { page }
      },
    })
    .query("listPages", {
      input: z.void(),
      output: z.object({
        pages: z.array(pageSchema),
      }),
      resolve: async ({ ctx }) => {
        return { pages: Array.from(ctx.pages.values()) }
      },
    })
})

export default uiModule
