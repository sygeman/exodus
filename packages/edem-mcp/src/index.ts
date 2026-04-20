/**
 * Edem MCP Gateway — JSON-RPC server, tool registry, and AI agent interface.
 *
 * Mock implementation for integration testing.
 */

import { type Evento, type Module, nextDepth } from "@exodus/edem-core"

export interface McpTool {
  name: string
  description: string
  module: string
}

/**
 * Create the MCP module.
 *
 * Events:
 *   Commands:  mcp:register_tools, mcp:call_tool
 *   Facts:     mcp:tools_registered, mcp:tool_result
 *   Errors:    mcp:error
 */
export function createMcpModule(): Module {
  const tools = new Map<string, McpTool>()

  return {
    name: "mcp",
    init(evento: Evento) {
      // Register tools from modules
      evento.handle("mcp:register_tools", (ctx) => {
        const { module, tools: newTools } = ctx.payload as {
          module: string
          tools: McpTool[]
        }

        for (const tool of newTools) {
          tools.set(tool.name, { ...tool, module })
        }

        evento.emit(
          "mcp:tools_registered",
          { module, count: newTools.length },
          nextDepth(ctx.meta),
        )

        return { registered: newTools.length }
      })

      // Call tool — proxies to module's event
      evento.handle("mcp:call_tool", async (ctx) => {
        const { name, args } = ctx.payload as { name: string; args: unknown }
        const tool = tools.get(name)
        if (!tool) throw new Error(`Tool ${name} not found`)

        // Proxy to the module's handler
        // Tool names use colon separator: "data:create_item"
        const result = await evento.request(name, args, nextDepth(ctx.meta))

        evento.emit(
          "mcp:tool_result",
          { tool: name, result },
          nextDepth(ctx.meta),
        )

        return result
      })

      // List all registered tools
      evento.handle("mcp:list_tools", () => {
        return { tools: Array.from(tools.values()) }
      })
    },
  }
}
