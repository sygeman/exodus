# MCP Layer

## Overview

End-to-end interface for AI agents. Full application control.

MCP (Model Context Protocol) — gateway between event-driven architecture and external AI agents.

## Architecture

```
AI Agent (HTTP/stdio)
    ↓
MCP Module (JSON-RPC)
    ↓ (events)
Edem Modules
```

## Concepts

### Tool

A function exposed to AI agents.

```typescript
type Tool = {
  name: string
  description: string
  input_schema: object   // JSON Schema
  module: string         // Which module owns this tool
}
```

### Tool Registration

Modules register their tools:

```typescript
// Data module registers tools
mcp:register_tools → {
  module: "data",
  tools: [
    {
      name: "data_list_collections",
      description: "List all collections",
      input_schema: { type: "object", properties: {} }
    },
    {
      name: "data_create_item",
      description: "Create an item in a collection",
      input_schema: {
        type: "object",
        properties: {
          collection_id: { type: "string" },
          data: { type: "object" }
        },
        required: ["collection_id", "data"]
      }
    }
  ]
}
```

### Tool Call

AI agent calls a tool:

```typescript
// 1. Agent sends via MCP
{
  jsonrpc: "2.0",
  method: "tools/call",
  params: {
    name: "data_create_item",
    arguments: {
      collection_id: "games",
      data: { title: "Elden Ring" }
    }
  }
}

// 2. MCP emits event to module
mcp:call_tool → {
  name: "data_create_item",
  args: { collection_id: "games", data: { title: "Elden Ring" } },
  correlation_id: "corr_123"
}

// 3. Module executes, responds
mcp:tool_result → {
  correlation_id: "corr_123",
  result: {
    item_id: "item_xyz",
    collection_id: "games",
    data: { title: "Elden Ring" }
  }
}

// 4. MCP returns to agent
{
  jsonrpc: "2.0",
  result: { ... }
}
```

## Available Tools by Module

### Data Module

| Tool | Description |
|------|-------------|
| `data_list_collections` | List all collections |
| `data_get_collection` | Get collection by ID |
| `data_create_collection` | Create new collection |
| `data_update_collection` | Update collection |
| `data_delete_collection` | Delete collection |
| `data_list_items` | Query items in collection |
| `data_get_item` | Get single item |
| `data_create_item` | Create item |
| `data_update_item` | Update item |
| `data_delete_item` | Delete item |

### UI Module

| Tool | Description |
|------|-------------|
| `ui_list_pages` | List all pages |
| `ui_get_page` | Get page by ID |
| `ui_create_page` | Create new page |
| `ui_update_page` | Update page |
| `ui_delete_page` | Delete page |
| `ui_generate_page` | Generate page via AI |

### Flows Module

| Tool | Description |
|------|-------------|
| `flows_list_flows` | List all flows |
| `flows_get_flow` | Get flow by ID |
| `flows_create_flow` | Create new flow |
| `flows_update_flow` | Update flow |
| `flows_delete_flow` | Delete flow |
| `flows_run_flow` | Execute flow |

### Runners Module

| Tool | Description |
|------|-------------|
| `runners_list_runners` | List all runners |
| `runners_register_runner` | Register new runner |
| `runners_create_task` | Create task |
| `runners_get_task` | Get task status |

## Events

### Commands

```typescript
// Register tools
mcp:register_tools → mcp:tools_registered

// Call tool
mcp:call_tool → mcp:tool_result
```

### Event Schemas

```typescript
// mcp:register_tools
{
  module: string,
  tools: Tool[],
  source: string,
  depth: number,
  trace_id: string,
  timestamp: number
}

// mcp:call_tool
{
  name: string,
  args: object,
  correlation_id: string,
  source: string,
  depth: number,
  trace_id: string,
  timestamp: number
}

// mcp:tool_result
{
  correlation_id: string,
  result?: object,
  error?: AppError,
  source: string,
  depth: number,
  trace_id: string,
  timestamp: number
}
```

## AI Agent Interaction Example

```
User: "Add Elden Ring to my games"

Agent:
1. MCP: data_list_collections → find "games" collection
2. MCP: data_create_item → create item with title "Elden Ring"
3. MCP: tasks:create (type: "download", input: { 
     url: "https://.../elden-ring-cover.jpg" 
   })
4. Wait for tasks:completed
5. MCP: data_update_item → set cover image

Result: Game added with cover downloaded
```

## Security

### Local Only

- MCP server binds to localhost only
- No external network access
- stdio transport for local agents

### Permission Model

```typescript
type McpPermission = {
  tool: string           // Tool name or wildcard
  allowed: boolean       // Allow/deny
  conditions?: object    // Optional conditions
}

// Example: allow only read operations
[
  { tool: "data_list_*", allowed: true },
  { tool: "data_get_*", allowed: true },
  { tool: "data_create_*", allowed: false },
  { tool: "data_update_*", allowed: false },
  { tool: "data_delete_*", allowed: false }
]
```

## Transport

### stdio (Default)

For local AI agents running on the same machine.

```bash
# Agent connects via stdio
edem --mcp-stdio
```

### HTTP (Optional)

For remote agents or development.

```bash
# MCP server on localhost:3000
edem --mcp-http --port 3000
```
