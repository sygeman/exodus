# Flows Layer

## Overview

Visual programming of application behavior. All business logic in one place.

Reference: **Unreal Blueprints**

## Concepts

### Flow

A workflow — a graph of nodes connected by edges.

```typescript
type Flow = {
  id: string
  name: string
  trigger: Trigger
  nodes: Node[]
  edges: Edge[]
  meta?: object
}
```

### Trigger

What starts the flow.

| Trigger Type | Description | Example |
|--------------|-------------|---------|
| `event` | React to system event | "data:item_created" |
| `schedule` | Run on timer | "0 9 * * *" (cron) |
| `manual` | Run by user action | Button click |
| `webhook` | External HTTP call | POST /hooks/xxx |

### Node

A single step in the flow.

```typescript
type Node = {
  id: string
  type: string           // node type identifier
  position: { x: number, y: number }
  data: object           // node-specific configuration
}
```

### Node Types

| Category | Node | Description |
|----------|------|-------------|
| **Logic** | `condition` | If/else branch |
| | `switch` | Multiple branches |
| | `loop` | Iterate over array |
| | `delay` | Wait N seconds |
| **Data** | `query` | Query collection |
| | `create` | Create item |
| | `update` | Update item |
| | `delete` | Delete item |
| **Transform** | `map` | Transform data |
| | `filter` | Filter array |
| | `merge` | Merge objects |
| | `parse_json` | Parse JSON string |
| **External** | `http_request` | HTTP call |
| | `run_script` | Execute code |
| | `send_email` | Send email |
| **Flow** | `call_flow` | Run another flow |
| | `return` | Return result |
| | `error` | Throw error |

### Edge

Connection between nodes.

```typescript
type Edge = {
  id: string
  source: string         // source node id
  target: string         // target node id
  sourceHandle?: string  // output port (for multiple outputs)
  targetHandle?: string  // input port
  condition?: string     // condition for this path (e.g., "true", "false")
}
```

## Flow Execution

### Execution Context

```typescript
type FlowContext = {
  flow_id: string
  run_id: string
  trigger: TriggerResult
  variables: Map<string, unknown>  // Node outputs stored here
  depth: number                    // Event depth for loop detection
  trace_id: string
}
```

### Execution Model

1. Trigger fires → create Flow Run
2. Execute start node
3. Follow edges to next nodes
4. Store node output in variables
5. Continue until end node or error

```
+--------+     +-----------+     +----------+     +--------+
| Trigger| --> | Node A    | --> | Node B   | --> | End    |
|        |     | (query)   |     | (filter) |     |        |
+--------+     +-----------+     +----------+     +--------+
                      |                |
                      v                v
                 variables["a"]   variables["b"]
```

## Events

### Commands

```typescript
// Create flow
flows:create → flows:flow_created

// Update flow
flows:update → flows:flow_updated

// Delete flow
flows:delete → flows:flow_deleted

// Run flow
flows:run → flows:run_started

// Cancel run
flows:cancel → flows:run_cancelled
```

### Lifecycle Events

```typescript
// flows:run_started
{
  run_id: string,
  flow_id: string,
  trigger: TriggerResult,
  source: string,
  depth: number,
  trace_id: string,
  timestamp: number
}

// flows:node_executed
{
  run_id: string,
  node_id: string,
  node_type: string,
  input: object,
  output: object,
  duration_ms: number,
  source: string,
  depth: number,
  trace_id: string,
  timestamp: number
}

// flows:run_completed
{
  run_id: string,
  flow_id: string,
  status: "success" | "error" | "cancelled",
  result?: object,
  error?: AppError,
  source: string,
  depth: number,
  trace_id: string,
  timestamp: number
}
```

## Example Flow

### Auto-tag new games

```typescript
// Trigger: when item created in "games" collection
{
  type: "event",
  event: "data:item_created",
  filter: { collection_id: "games" }
}

// Nodes:
// 1. condition: Does item have genre field?
//    - true → 2. update: Add tag based on genre
//    - false → 3. return: Do nothing
```

### Daily backup

```typescript
// Trigger: every day at 3 AM
{
  type: "schedule",
  cron: "0 3 * * *"
}

// Nodes:
// 1. query: Get all collections
// 2. loop: For each collection
//    2a. query: Get all items
//    2b. http_request: Send to backup runner
// 3. return: Backup complete
```

## Flow ↔ Data Integration

Flows react to data events and manipulate data:

```
data:item_created ──▶ flows:run (trigger) ──▶ data:update_item
```

## Flow ↔ UI Integration

Flows can be triggered from UI:

```
user:click_button ──▶ flows:run (manual trigger)
```

Flows can update UI via events:

```
flows:run_completed ──▶ ui:show_notification
```
