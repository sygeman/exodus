# Edem Runners

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
  url: string
  token: string
  tags: string[]
  status: "online" | "offline" | "busy"
  last_seen: number
}
```

### Task

A unit of work to be executed.

```typescript
type Task = {
  id: string
  type: string
  input: object
  priority: number
  status: TaskStatus
  runner_id?: string
}

type TaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled"
```

### Task Types

| Type | Required Tags |
|------|---------------|
| `download` | `["download"]` |
| `convert` | `["conversion"]` |
| `compress` | `["storage"]` |
| `extract` | `["storage"]` |
| `ocr` | `["ai", "ocr"]` |
| `transcribe` | `["ai", "transcribe"]` |
| `scan` | `["security"]` |
| `backup` | `["storage"]` |
| `custom` | `[]` |

## Task Queue

Priority queue with FIFO within same priority.

## Events

### Commands

```typescript
tasks:create → tasks:created
tasks:cancel → tasks:cancelled
runners:register → runners:registered
runners:unregister → runners:unregistered
```

### Lifecycle Events

```typescript
tasks:created
tasks:started
tasks:progress
tasks:completed
tasks:failed
```

## Documentation

- [Runners Layer](./docs/runners.md) — Full runners layer specification
