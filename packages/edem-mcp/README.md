# Edem MCP Gateway

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
  input_schema: object
  module: string
}
```

### Tool Registration

Modules register their tools at initialization. MCP automatically exposes them as AI tools.

### Tool Call Flow

1. Agent sends via MCP (JSON-RPC)
2. MCP emits event to module
3. Module executes, responds
4. MCP returns result to agent

## Available Tools by Module

### Data Module
- `data_list_collections`, `data_get_collection`, `data_create_collection`, `data_update_collection`, `data_delete_collection`
- `data_list_items`, `data_get_item`, `data_create_item`, `data_update_item`, `data_delete_item`

### UI Module
- `ui_list_pages`, `ui_get_page`, `ui_create_page`, `ui_update_page`, `ui_delete_page`, `ui_generate_page`

### Flows Module
- `flows_list_flows`, `flows_get_flow`, `flows_create_flow`, `flows_update_flow`, `flows_delete_flow`, `flows_run_flow`

### Runners Module
- `runners_list_runners`, `runners_register_runner`, `runners_create_task`, `runners_get_task`

## Events

### Commands

```typescript
mcp:register_tools → mcp:tools_registered
mcp:call_tool → mcp:tool_result
```

## Security

- MCP server binds to localhost only
- No external network access
- stdio transport for local agents
- Permission model with wildcard support

## Transport

### stdio (Default)
```bash
edem --mcp-stdio
```

### HTTP (Optional)
```bash
edem --mcp-http --port 3000
```

## Documentation

- [MCP Layer](./docs/mcp.md) — Full MCP layer specification
