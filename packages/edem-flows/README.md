# Edem Flows

Движок визуального программирования для Edem — flows, nodes, edges, execution engine, template resolution.

## Установка

```typescript
import { flowsModule } from "@exodus/edem-flows"
import { dataModule } from "@exodus/edem-data"
import { createEdem } from "@exodus/edem-core"

const edem = createEdem([dataModule, flowsModule])
```

## Концепции

### Flow

Workflow — граф нод, соединённых edges.

```typescript
type Flow = {
  id: string
  name: string
  trigger: Trigger
  nodes: FlowNode[]
  edges: FlowEdge[]
  meta?: Record<string, unknown>
}
```

### Trigger Types

| Type | Описание |
|------|----------|
| `event` | Реакция на системное событие |
| `schedule` | По расписанию (cron) |
| `manual` | Ручной запуск |
| `webhook` | HTTP вызов |

### Node Types

| Category | Node | Описание |
|----------|------|----------|
| **Logic** | `trigger` | Точка входа, pass-through |
| | `condition` | Условие (eq/ne/gt/lt/contains) |
| | `switch` | Множественный выбор |
| | `loop` | Цикл с итерациями |
| | `delay` | Пауза N секунд |
| **Data** | `input` | Входные данные (trigger inputs) |
| | `output` | Выходные данные (template resolution) |
| **Transform** | `transform` | Трансформация (set/add/multiply/append) |
| **External** | `action` | Внешняя задача (async callback) |
| | `subflow` | Вложенный flow |
| **Flow** | `fork` | Параллельные ветки |
| | `join` | Ожидание веток (all/any/n_of_m) |

### Edge

Связь между нодами.

```typescript
type FlowEdge = {
  id: string
  source: string         // source node id
  target: string         // target node id
  sourceHandle?: string  // output port
  targetHandle?: string  // input port
  label?: string         // для switch/fork matching
}
```

## API

### Mutations

#### `createFlow`

```typescript
const { flow_id } = await edem.flows.createFlow({
  name: "My Flow",
  trigger: { type: "manual" },
  nodes: [
    { id: "n1", type: "trigger", position: { x: 0, y: 0 } },
    { id: "n2", type: "transform", position: { x: 100, y: 0 }, data: { field: "value", operation: "add", value: 10 } },
  ],
  edges: [
    { id: "e1", source: "n1", target: "n2" },
  ],
})
```

#### `updateFlow`

```typescript
await edem.flows.updateFlow({
  flow_id: "...",
  name: "Updated Name",
  nodes: [...],
  edges: [...],
})
```

#### `deleteFlow`

```typescript
await edem.flows.deleteFlow({ flow_id: "..." })
```

#### `runFlow`

Запуск flow. Может вернуть `waiting` если flow содержит async nodes (action, loop, subflow).

```typescript
const { run_id, status } = await edem.flows.runFlow({
  flow_id: "...",
  trigger_data: { name: "Alice", value: 42 },
})
// status: "completed" | "waiting" | "error"
```

#### `handleNodeCompleted`

Resume после async node (action, loop, subflow).

```typescript
await edem.flows.handleNodeCompleted({
  run_id: "...",
  node_id: "...",
  output: { result: "success" },
})
```

#### `handleNodeFailed`

Завершить с ошибкой.

```typescript
await edem.flows.handleNodeFailed({
  run_id: "...",
  node_id: "...",
  error: "Something went wrong",
})
```

#### `cancelRun`

```typescript
await edem.flows.cancelRun({ run_id: "..." })
```

### Queries

#### `getFlow`

```typescript
const { flow } = await edem.flows.getFlow({ flow_id: "..." })
// flow | null
```

#### `listFlows`

```typescript
const { flows } = await edem.flows.listFlows()
// Flow[]
```

#### `getRun`

```typescript
const { run } = await edem.flows.getRun({ run_id: "..." })
// { id, flow_id, status, input, output, context, waiting_node_id, error, started_at, completed_at }
```

#### `listRuns`

```typescript
const { runs } = await edem.flows.listRuns({
  flow_id: "...",
  status: "completed",
})
```

### Subscriptions

#### `flowCreated`

```typescript
edem.flows.flowCreated(async ({ event }) => {
  console.log(event.id, event.name)
})
```

#### `flowUpdated`

```typescript
edem.flows.flowUpdated(async ({ event }) => {
  console.log(event.id, event.name)
})
```

#### `flowDeleted`

```typescript
edem.flows.flowDeleted(async ({ event }) => {
  console.log(event.flow_id)
})
```

#### `runStarted`

```typescript
edem.flows.runStarted(async ({ event }) => {
  console.log(event.id, event.flow_id, event.status)
})
```

#### `runCompleted`

```typescript
edem.flows.runCompleted(async ({ event }) => {
  console.log(event.id, event.status, event.output)
})
```

#### `runUpdated`

```typescript
edem.flows.runUpdated(async ({ event }) => {
  console.log(event.id, event.status)
})
```

## Template Resolution

Syntax: `{{scope.path.to.value}}`

| Scope | Example | Описание |
|-------|---------|----------|
| `trigger` | `{{trigger.inputs.name}}` | Данные триггера |
| `nodes` | `{{nodes.node_id.output.field}}` | Output ноды |
| `context` | `{{context.my_var}}` | Переменная flow |

### Пример

```typescript
// Node config
{ "title": "{{trigger.inputs.name}} - {{nodes.abc.output.count}}" }

// Resolved
{ "title": "Alice - 42" }
```

## Execution Model

### Sync Nodes

```
trigger → condition → transform → output
              ↓
         follow edge by handle ("true"/"false")
```

### Async Nodes (action, loop, subflow)

```
trigger → action → (pause) → handleNodeCompleted → transform → output
              ↑
              └─ status: "waiting"
```

### Fork/Join

```
trigger → fork → branch_a → transform_a ─┐
              │                            ├─ join → output
              └─ branch_b → transform_b ─┘
```

## FlowRun Status

```
pending → running → waiting → completed
                   ↘ error
                   ↘ cancelled
```

Terminal states: `completed`, `error`, `cancelled`

## Node Executors

### condition

```typescript
{
  type: "condition",
  data: {
    field: "status",
    value: "active",
    operator: "eq"  // eq | ne | gt | lt | gte | lte | contains
  }
}
```

Returns `{ result: boolean }`. Follows edges with `sourceHandle: "true"` or `"false"`.

### transform

```typescript
{
  type: "transform",
  data: {
    field: "price",
    operation: "multiply",  // set | add | multiply | append
    value: 2
  }
}
```

Returns `{ result: unknown }`.

### switch

```typescript
{
  type: "switch",
  data: {
    value: "{{trigger.inputs.type}}",
    cases: [
      { value: "a", handle: "case_a" },
      { value: "b", handle: "case_b" },
    ],
    default_handle: "default"
  }
}
```

Follows edges by `label` matching.

### loop

```typescript
{
  type: "loop",
  data: {
    maxIterations: 10,
    action: "process_item"
  }
}
```

Tracks iterations in `context.flow_variables["nodes.{id}.currentIteration"]`.

### fork

```typescript
{
  type: "fork",
  data: {
    branches: [
      { id: "branch_a" },
      { id: "branch_b" },
    ]
  }
}
```

Follows edges by `label` matching (branch id).

### join

```typescript
{
  type: "join",
  data: {
    mode: "all"  // all | any | n_of_m
  }
}
```

### action

```typescript
{
  type: "action",
  data: {
    action: "send_email",
    to: "{{trigger.inputs.email}}"
  }
}
```

Returns `status: "async"`. Requires `handleNodeCompleted` callback.

### subflow

```typescript
{
  type: "subflow",
  data: {
    flow_id: "other-flow-id"
  }
}
```

Returns `status: "async"`. Requires `handleNodeCompleted` callback.

## Пример

```typescript
import { createEdem } from "@exodus/edem-core"
import { dataModule } from "@exodus/edem-data"
import { flowsModule } from "@exodus/edem-flows"

const edem = createEdem([dataModule, flowsModule])

// Создание flow
const { flow_id } = await edem.flows.createFlow({
  name: "Auto-tag Items",
  trigger: { type: "event", event: "data:item_created" },
  nodes: [
    { id: "n1", type: "trigger", position: { x: 0, y: 0 } },
    {
      id: "n2",
      type: "condition",
      position: { x: 100, y: 0 },
      data: { field: "genre", value: "RPG", operator: "eq" },
    },
    {
      id: "n3",
      type: "transform",
      position: { x: 200, y: 0 },
      data: { field: "tag", operation: "set", value: "rpg" },
    },
    {
      id: "n4",
      type: "output",
      position: { x: 300, y: 0 },
      data: { outputs: { tag: "{{nodes.n3.output.result}}" } },
    },
  ],
  edges: [
    { id: "e1", source: "n1", target: "n2" },
    { id: "e2", source: "n2", target: "n3", sourceHandle: "true" },
    { id: "e3", source: "n3", target: "n4" },
  ],
})

// Запуск
const { run_id, status } = await edem.flows.runFlow({
  flow_id,
  trigger_data: { genre: "RPG", title: "Elden Ring" },
})

console.log(status) // "completed"
```

## Видение

Полная спецификация: [docs/spec.md](./docs/spec.md)
