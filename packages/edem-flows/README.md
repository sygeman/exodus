# Edem Flow Engine

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

### Trigger Types

| Type | Description |
|------|-------------|
| `event` | React to system event |
| `schedule` | Run on timer (cron) |
| `manual` | Run by user action |
| `webhook` | External HTTP call |

### Node Types

| Category | Nodes |
|----------|-------|
| **Logic** | condition, switch, loop, delay |
| **Data** | query, create, update, delete |
| **Transform** | map, filter, merge, parse_json |
| **External** | http_request, run_script, send_email |
| **Flow** | call_flow, return, error |

## Execution Model

1. Trigger fires → create Flow Run
2. Execute start node
3. Follow edges to next nodes
4. Store node output in variables
5. Continue until end node or error

## Events

### Commands

```typescript
flows:create → flows:flow_created
flows:update → flows:flow_updated
flows:delete → flows:flow_deleted
flows:run → flows:run_started
flows:cancel → flows:run_cancelled
```

### Lifecycle Events

```typescript
flows:run_started
flows:node_executed
flows:run_completed
```

## Documentation

- [Flows Layer](./docs/flows.md) — Full flows layer specification
