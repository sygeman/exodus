import { z } from "zod"
import { createEdemModule } from "@exodus/edem-core"

export const toolSchema = z.object({
  name: z.string(),
  description: z.string(),
  module: z.string(),
})

export const mcpModule = createEdemModule("mcp", (module) => {
  return module
    .context(async () => ({
      tools: new Map<string, z.infer<typeof toolSchema>>(),
    }))
    .subscription("toolsRegistered", {
      output: z.object({
        module: z.string(),
        count: z.number(),
      }),
    })
    .subscription("toolResult", {
      output: z.object({
        tool: z.string(),
        result: z.unknown(),
      }),
    })
    .mutation("registerTools", {
      input: z.object({
        module: z.string(),
        tools: z.array(
          z.object({
            name: z.string(),
            description: z.string(),
          }),
        ),
      }),
      output: z.object({
        registered: z.number(),
      }),
      resolve: async ({ input, ctx, emit }) => {
        for (const tool of input.tools) {
          ctx.tools.set(tool.name, { ...tool, module: input.module })
        }
        await emit.toolsRegistered({ module: input.module, count: input.tools.length })
        return { registered: input.tools.length }
      },
    })
    .mutation("callTool", {
      input: z.object({
        name: z.string(),
        args: z.unknown(),
      }),
      output: z.unknown(),
      resolve: async ({ input, ctx }) => {
        const tool = ctx.tools.get(input.name)
        if (!tool) throw new Error(`Tool ${input.name} not found`)
        return { tool: input.name, args: input.args }
      },
    })
    .query("listTools", {
      input: z.void(),
      output: z.object({
        tools: z.array(toolSchema),
      }),
      resolve: async ({ ctx }) => {
        return { tools: Array.from(ctx.tools.values()) }
      },
    })
})

export default mcpModule
