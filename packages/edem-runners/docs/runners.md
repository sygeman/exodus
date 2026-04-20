# Runners Layer

## Overview

Infrastructure for executing heavy tasks. Distributed execution.

Reference: **GitLab Runners**

## Concepts

### Runner

An executor that performs tasks.

```typescript
type Runner = {
  id: string
  name: string
  url: string             // Runner address
  token: string           // Registration token
  tags: string[]          // Capabilities: ["storage", "conversion", "download"]
  status: "online" | "offline" | "busy"
  last_seen: number
  meta?: object
}
```

### Task

A unit of work to be executed.

```typescript
type Task = {
  id: string
  type: string            // Task type identifier
  input: object           // Task input data
  priority: number        // 1-10, lower = higher priority
  status: TaskStatus
  runner_id?: string      // Assigned runner
  created_at: number
  started_at?: number
  completed_at?: number
  retry_count: number
  max_retries: number
  error?: AppError
}

type TaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled"
```

### Task Types

| Type | Description | Required Tags |
|------|-------------|---------------|
| `download` | Download file from URL | `["download"]` |
| `convert` | Convert media format | `["conversion"]` |
| `compress` | Compress file/archive | `["storage"]` |
| `extract` | Extract archive | `["storage"]` |
| `ocr` | Text recognition from image | `["ai", "ocr"]` |
| `transcribe` | Audio to text | `["ai", "transcribe"]` |
| `scan` | Virus scan | `["security"]` |
| `backup` | Create backup | `["storage"]` |
| `custom` | User-defined task | `[]` |

## Task Queue

### Queue Model

Priority queue with FIFO within same priority.

```
Priority 1: [task_3, task_5]     ← Execute first
Priority 2: [task_1, task_4]
Priority 5: [task_2]
```

### Task Assignment

1. Task created with required tags
2. Scheduler finds matching runner (online + has all tags)
3. Assign task to runner
4. Runner executes, reports progress
5. On completion, emit `tasks:completed`

### Retry Logic

```typescript
// Exponential backoff
function getRetryDelay(retryCount: number): number {
  return Math.min(1000 * Math.pow(2, retryCount), 30000) // Max 30s
}

// Retry conditions
const RETRYABLE_ERRORS = [
  "TIMEOUT",
  "NETWORK_ERROR",
  "RUNNER_OFFLINE",
  "TEMPORARY_FAILURE"
]
```

## Events

### Commands

```typescript
// Create task
tasks:create → tasks:created

// Cancel task
tasks:cancel → tasks:cancelled

// Register runner
runners:register → runners:registered

// Unregister runner
runners:unregister → runners:unregistered
```

### Lifecycle Events

```typescript
// tasks:created
{
  task_id: string,
  type: string,
  input: object,
  priority: number,
  source: string,
  depth: number,
  trace_id: string,
  timestamp: number
}

// tasks:started
{
  task_id: string,
  runner_id: string,
  source: string,
  depth: number,
  trace_id: string,
  timestamp: number
}

// tasks:progress
{
  task_id: string,
  progress: number,      // 0-100
  message?: string,
  source: string,
  depth: number,
  trace_id: string,
  timestamp: number
}

// tasks:completed
{
  task_id: string,
  output: object,
  duration_ms: number,
  source: string,
  depth: number,
  trace_id: string,
  timestamp: number
}

// tasks:failed
{
  task_id: string,
  error: AppError,
  retry_count: number,
  will_retry: boolean,
  source: string,
  depth: number,
  trace_id: string,
  timestamp: number
}
```

## Runner Registration

### Simple Registration

```typescript
// Runner starts, registers itself
runners:register → {
  name: "My Laptop",
  url: "http://192.168.1.5:8080",
  token: "secret_token_123",
  tags: ["storage", "conversion"]
}

// Server responds
runners:registered → {
  runner_id: "runner_abc123",
  status: "online"
}
```

### Heartbeat

```typescript
// Runner sends heartbeat every 30s
runners:heartbeat → {
  runner_id: "runner_abc123",
  status: "online",      // or "busy"
  active_tasks: number
}
```

## Local vs Remote Runners

| Aspect | Local Runner | Remote Runner |
|--------|-------------|---------------|
| Location | Same machine | Another device |
| Registration | Auto (built-in) | Manual (token + URL) |
| Use case | Default processing | Heavy tasks, GPU, etc. |
| Setup | None | Install runner binary |

### Default Local Runner

Built into the application. Always available.

```typescript
const localRunner: Runner = {
  id: "local",
  name: "Local",
  url: "internal",
  token: "",
  tags: ["storage"],
  status: "online"
}
```

## Flow ↔ Runners Integration

Flows create tasks for runners:

```
flows:node_executed (http_request) ──▶ tasks:create (type: "download")
                                       tasks:created
                                       tasks:completed ──▶ flows:continue
```

## Example: Download Workflow

```
1. User pastes URL in UI
2. UI emits: flows:run (trigger: manual)
3. Flow executes:
   a. Node: validate_url
   b. Node: tasks:create (type: "download", input: { url })
   c. Wait for tasks:completed
   d. Node: data:create_item (collection: "downloads")
4. UI shows completed download
```
