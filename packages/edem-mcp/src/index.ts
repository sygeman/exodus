/**
 * Edem MCP Gateway — JSON-RPC server, tool registry, and AI agent interface.
 *
 * Mock implementation for integration testing.
 */

import { type Edem } from "@exodus/edem-core"

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
export function createMcpModule(edem: Edem) {
  const tools = new Map<string, McpTool>()

  // Register tools from modules
  edem.handle("mcp:register_tools", (ctx) => {
    const { module, tools: newTools } = ctx.payload as {
      module: string
      tools: McpTool[]
    }

    for (const tool of newTools) {
      tools.set(tool.name, { ...tool, module })
    }

    edem.emit("mcp:tools_registered", { module, count: newTools.length })

    return { registered: newTools.length }
  })

  // Call tool — proxies to module's event
  edem.handle("mcp:call_tool", async (ctx) => {
    const { name, args } = ctx.payload as { name: string; args: unknown }
    const tool = tools.get(name)
    if (!tool) throw new Error(`Tool ${name} not found`)

    // Proxy to the module's handler
    // Tool names use colon separator: "data:create_item"
    const result = await edem.request(name, args)

    edem.emit("mcp:tool_result", { tool: name, result })

    return result
  })

  // List all registered tools
  edem.handle("mcp:list_tools", () => {
    return { tools: Array.from(tools.values()) }
  })

  // === Public API ===
  edem.mcp = {
    registerTools: (params: { module: string; tools: McpTool[] }) =>
      edem.request("mcp:register_tools", params),
    callTool: (params: { name: string; args: unknown }) => edem.request("mcp:call_tool", params),
    listTools: () => edem.request("mcp:list_tools", {}),
  }
}
