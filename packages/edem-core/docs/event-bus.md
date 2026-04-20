# Event Bus Specification

## Overview

The event bus is the nervous system of Edem. All communication between modules happens through events.

## Principles

1. **No direct dependencies** between modules
2. **Command events** — incoming requests for action
3. **Fact events** — outgoing notifications about results
4. **Source tracking** — traceability via `source` field

## Event Format

### Base Event

```typescript
type Event = {
  type: string           // "{module}:{action}" or "{module}:{entity}_{result}"
  payload: {
    source: string       // "{origin}:{id}" — who initiated
    depth: number        // 0-25 — loop protection
    timestamp: number    // unix ms
    trace_id: string     // uuid — links event chain
    [key: string]: any   // event-specific data
  }
}
```

### Source Format

```
"{origin}:{id}"

origin = "user" | "flows" | "tasks" | "data" | "system" | "mcp"
id     = uuid or action name
```

### Examples

```typescript
// Command
{ type: "data:create_item", payload: {
    source: "flows:run_abc123",
    depth: 2,
    trace_id: "550e8400-e29b-41d4-a716-446655440000",
    timestamp: 1705123456789,
    collection_id: "games",
    data: { title: "Elden Ring" }
}}

// Fact
{ type: "data:item_created", payload: {
    source: "flows:run_abc123",
    depth: 3,
    trace_id: "550e8400-e29b-41d4-a716-446655440000",
    timestamp: 1705123456790,
    item_id: "item_xyz",
    collection_id: "games",
    data: { title: "Elden Ring" }
}}

// Error
{ type: "data:error", payload: {
    source: "flows:run_abc123",
    depth: 3,
    trace_id: "550e8400-e29b-41d4-a716-446655440000",
    timestamp: 1705123456791,
    action: "create_item",
    error: { code: "VALIDATION_ERROR", message: "...", details: {...} }
}}
```

## Naming Conventions

### Command Events (Incoming)

```
{module}:{action}

settings:set
data:create_item
flows:run
tasks:create
```

### Result Events (Outgoing)

```
{module}:{entity}_{action}

settings:changed
data:item_created
flows:run_completed
tasks:task_completed
```

### Error Events

```
{module}:error

data:error
flows:error
tasks:error
```

## Communication Patterns

### Event Notification (Fire-and-forget)

For state notifications. Publisher doesn't wait for response.

```typescript
// Settings changed
emit("settings:changed", { key, old_value, new_value })

// Events module listens and updates
on("settings:changed", (event) => {
    if (key.startsWith("events.")) {
        update_config(event.new_value)
    }
})
```

### Request-Response (with correlation ID)

For requesting data between modules.

```typescript
// 1. Module requests data
const correlation_id = crypto.randomUUID()
const response = await request("settings:query", {
    keys: ["events.retention_days", "events.max_count"]
}, { timeout: 200 })

// 2. Settings module handles
handle("settings:query", (ctx) => {
    const result = {}
    for (const key of ctx.payload.keys) {
        result[key] = get_setting(key)
    }
    return result  // Auto-reply with correlation_id
})
```

### Event-Carried State Transfer

Events carry full state, subscribers update local copies.

```typescript
// Settings emits full data
emit("settings:initialized", {
    "events.retention_days": 7,
    "events.max_count": 100000,
    "notifications.enabled": true
})

// Events listens once at init
once("settings:initialized", (event) => {
    retention_days = event.data["events.retention_days"]
    max_count = event.data["events.max_count"]
})
```

## Loop Detection

Protection against infinite event loops.

### Depth Mechanism

```typescript
// Constants
MAX_EVENT_DEPTH = 25
DEPTH_WARNING_THRESHOLD = 20

// In payload
payload: {
  source: "flows:run_abc123",
  depth: 3,
  ...
}
```

### Rules

1. On emit — check depth in payload
2. If depth >= MAX_EVENT_DEPTH — reject event, log warning
3. When forwarding event — depth + 1
4. Events without depth (user action) start at 0

### Example

```
1. User clicks button (depth: 0)
2. Flow A triggers (depth: 1)
3. Flow A creates item (depth: 2)
4. item_created triggers Flow B (depth: 3)
...
20. depth=20 → notification: "Approaching event depth limit"
...
25. depth=25 → event rejected, error: DEPTH_EXCEEDED
```

## Trace ID

Links entire event chain from trigger to completion.

```
trigger (trace_id: abc) → flow:start (abc) → task:create (abc) → task:complete (abc)
```

### Rules

- Generated at first event in chain (user action, schedule trigger)
- Forwarded to all child events
- Used for filtering in event_log and debugging

## Error Format

Structured errors instead of strings.

```typescript
type AppError = {
  code: string           // Machine-readable code
  message: string        // Human-readable message (fallback)
  message_key?: string   // i18n key: "errors.validation.field_required"
  message_args?: object  // i18n args: { field: "title" }
  cause?: AppError       // Nested error (error chaining)
  details?: object       // Additional context
}
```

### Error Codes

```
// Validation
VALIDATION_ERROR        — invalid data
FIELD_REQUIRED          — required field missing
FIELD_INVALID           — field validation failed

// Resources
NOT_FOUND               — resource not found
ALREADY_EXISTS          — resource already exists
CONFLICT                — state conflict

// State
INVALID_STATE           — invalid state for operation
INVALID_TRANSITION      — invalid state transition

// Limits
DEPTH_EXCEEDED          — event depth exceeded
RATE_LIMITED            — rate limit exceeded
BACKPRESSURE_LIMIT      — queue limit exceeded
TIMEOUT                 — operation timeout

// System
INTERNAL_ERROR          — internal error
DB_ERROR                — database error
HANDLER_ERROR           — event handler error
```

### Examples

```typescript
// Simple error with i18n
{
  code: "INVALID_TRANSITION",
  message: "Cannot transition task from 'completed' to 'running'",
  message_key: "errors.task.invalid_transition",
  message_args: {
    current: "completed",
    requested: "running"
  },
  details: {
    entity: "task",
    entity_id: "task_123",
    current_state: "completed",
    requested_state: "running",
    allowed_transitions: ["pending"]
  }
}

// Error with chaining
{
  code: "FLOW_EXECUTION_FAILED",
  message: "Flow execution failed at node 'fetch_data'",
  message_key: "errors.flow.execution_failed",
  message_args: { node: "fetch_data" },
  cause: {
    code: "HTTP_ERROR",
    message: "Request failed with status 503",
    message_key: "errors.http.status_error",
    message_args: { status: 503 },
    cause: {
      code: "CONNECTION_TIMEOUT",
      message: "Connection timed out after 30s"
    }
  }
}
```

## Event Ordering Guarantees

### In-Process Events

For single-process architecture:

- Events delivered in emit order
- Handlers called synchronously
- No event loss (in-memory)

### Event Log Order

Events in event_log written with monotonic timestamp:

```typescript
// Atomic counter for ordering
let eventSequence = 0

function nextEventId(): string {
  const seq = eventSequence++
  return `${Date.now()}_${seq}`
}
```

### Causal Order (trace_id)

Events in one chain linked via trace_id:

```
trace_id: abc123
├── user:click (d0)
├── flows:run_started (d1)
├── tasks:created (d2)
├── tasks:completed (d3)
└── flows:run_completed (d4)
```

## Configuration

```typescript
// Settings
{
  "events.max_depth": 25,
  "events.depth_warning": 20,
  "events.retention_days": 7,
  "events.max_count": 100000
}
```
