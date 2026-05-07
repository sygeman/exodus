# Edem Flows

Движок визуального программирования — flows, nodes, edges, execution engine, template resolution.

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
  status: "draft" | "active" | "paused" | "archived"
  trigger: Trigger
  nodes: FlowNode[]
  edges: FlowEdge[]
  meta?: Record<string, unknown>
  backpressure?: {
    maxPending?: number
    maxConcurrent?: number
  }
}
```

### Trigger

| Type | Описание | Поля |
|------|----------|------|
| `event` | Реакция на системное событие | `event`, `filter?` |
| `schedule` | По расписанию | `every` (Nm/Nh/Nd/Nw), `at?`, `days?` |
| `manual` | Ручной запуск | — |
| `webhook` | HTTP вызов | `path` |

### FlowNode

```typescript
type FlowNode = {
  id: string
  type: string
  position: { x: number; y: number }
  data?: Record<string, unknown>
  retry_max?: number
  retry_delay?: number
  timeout?: number
}
```

### FlowEdge

```typescript
type FlowEdge = {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  condition?: string
  label?: string
}
```

### Node Types

| Category | Node | Описание |
|----------|------|----------|
| **Logic** | `trigger` | Точка входа, pass-through |
| | `condition` | Условие (eq/ne/gt/lt/gte/lte/contains) |
| | `switch` | Множественный выбор |
| | `loop` | Цикл с итерациями |
| | `delay` | Пауза N секунд |
| **Data** | `input` | Входные данные (trigger inputs) |
| | `output` | Выходные данные (template resolution) |
| **Transform** | `transform` | Трансформация (set/add/multiply/append) |
| **External** | `action` | Внешняя задача (sync или async callback) |
| | `subflow` | Вложенный flow |
| **Flow** | `fork` | Параллельные ветки |
| | `join` | Ожидание веток (all/any/n_of_m) |

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
  meta: { version: 1 },
  backpressure: { maxConcurrent: 3, maxPending: 5 },
})
```

#### `updateFlow`

```typescript
await edem.flows.updateFlow({
  flow_id: "...",
  name: "Updated Name",
  trigger: { type: "event", event: "data:item_created" },
  nodes: [...],
  edges: [...],
  meta: { version: 2 },
  backpressure: { maxConcurrent: 5 },
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

#### `cancelRun`

```typescript
await edem.flows.cancelRun({ run_id: "..." })
```

#### `resumeRun`

Возобновление run в статусе `waiting`.

```typescript
await edem.flows.resumeRun({ run_id: "..." })
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

Завершить async node с ошибкой.

```typescript
await edem.flows.handleNodeFailed({
  run_id: "...",
  node_id: "...",
  error: "Something went wrong",
})
```

### Queries

#### `getFlow`

```typescript
const { flow } = await edem.flows.getFlow({ flow_id: "..." })
// Flow | null
```

#### `listFlows`

```typescript
const { flows } = await edem.flows.listFlows()
// Flow[]
```

#### `getRun`

```typescript
const { run } = await edem.flows.getRun({ run_id: "..." })
// { id, flow_id, status, input, output, context, waiting_node_id, error, parent_run_id, started_at, completed_at } | null
```

#### `listRuns`

```typescript
const { runs } = await edem.flows.listRuns({
  flow_id: "...",
  status: "completed",
})
```

#### `getRunNodes`

```typescript
const { nodes } = await edem.flows.getRunNodes({ run_id: "..." })
// FlowRunNode[]
```

### Subscriptions

#### `flowCreated`

```typescript
edem.flows.flowCreated(async ({ event }) => {
  console.log(event.id, event.name, event.status)
})
```

#### `flowUpdated`

```typescript
edem.flows.flowUpdated(async ({ event }) => {
  console.log(event.id, event.name, event.status)
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

#### `runNodeStarted`

```typescript
edem.flows.runNodeStarted(async ({ event }) => {
  console.log(event.id, event.run_id, event.node_id, event.status, event.attempts)
})
```

#### `runNodeCompleted`

```typescript
edem.flows.runNodeCompleted(async ({ event }) => {
  console.log(event.id, event.run_id, event.node_id, event.status, event.output)
})
```

## Manifest

Manifest — декларативное описание flows для bootstrap и version control.

### `applyManifest`

Создаёт или обновляет flows из manifest. Сравнивает по `manifest_id`.

```typescript
const { created, updated, skipped } = await edem.flows.applyManifest({
  manifest: {
    flows: [
      {
        id: "my-flow",
        name: "My Flow",
        trigger: { type: "manual" },
        nodes: [
          { id: "n1", type: "trigger", position: { x: 0, y: 0 } },
          { id: "n2", type: "transform", position: { x: 100, y: 0 }, data: { field: "x", operation: "add", value: 1 } },
        ],
        edges: [{ id: "e1", source: "n1", target: "n2" }],
      },
    ],
  },
})
// created: ["my-flow"] | updated: [] | skipped: []
```

### `getManifest`

Экспорт всех flows как manifest JSON.

```typescript
const { flows } = await edem.flows.getManifest()
// FlowsManifest
```

### System Flows

Для bootstrap системных flows в Exodus:

```typescript
// apps/exodus/src/flows-manifest.ts
import type { FlowsManifest } from "@exodus/edem-flows"

export const SYSTEM_FLOWS_MANIFEST: FlowsManifest = {
  flows: [
    {
      id: "auto-updater",
      name: "Auto Updater",
      trigger: { type: "schedule", every: "15m" },
      nodes: [
        { id: "n1", type: "trigger", position: { x: 0, y: 0 } },
        { id: "n2", type: "action", position: { x: 100, y: 0 }, data: { action: "checkUpdate" } },
      ],
      edges: [{ id: "e1", source: "n1", target: "n2" }],
    },
  ],
}

// apps/exodus/src/flows-bootstrap.ts
import type { flowsModule } from "@exodus/edem-flows"
import { SYSTEM_FLOWS_MANIFEST } from "./flows-manifest"

export async function ensureFlows(flows: typeof flowsModule): Promise<void> {
  await flows.applyManifest({ manifest: SYSTEM_FLOWS_MANIFEST })
}
```

## Template Resolution

Syntax: `{{scope.path.to.value}}`

| Scope | Example | Описание |
|-------|---------|----------|
| `trigger` | `{{trigger.name}}` | Данные триггера |
| `nodes` | `{{nodes.node_id.output.field}}` | Output ноды (также `{{nodes.node_id.field}}`) |
| `context` | `{{context.my_var}}` | Переменная flow |

### Пример

```typescript
// Node config
{ "title": "{{trigger.name}} - {{nodes.abc.output.count}}" }

// Resolved
{ "title": "Alice - 42" }
```

## Execution Model

### Sync Nodes

```
trigger → condition → transform → output
              ↓
         follow edge by sourceHandle ("true"/"false")
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

Fork выполняет ветки параллельно через `Promise.all`. Join агрегирует результаты.

### Subflow

```
trigger → subflow (flow_id: "child") → (вложенный run) → output
```

Вложенный flow выполняется с `parent_run_id`. Context наследуется.

## FlowRun Status

```
pending → running → waiting → completed
                    ↘ error
                    ↘ cancelled
```

Терминальные состояния: `completed`, `error`, `cancelled`

Переходы между состояниями валидируются через `validateFlowRunTransition`.

## Node Executors

### trigger

Pass-through. Возвращает входные данные как output.

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

Возвращает `{ result: boolean }`. Следует по edges с `sourceHandle: "true"` или `"false"`.

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

Возвращает `{ result: unknown }`.

### switch

```typescript
{
  type: "switch",
  data: {
    value: "{{trigger.type}}",
    cases: [
      { value: "a", handle: "case_a" },
      { value: "b", handle: "case_b" },
    ],
    default_handle: "default"
  }
}
```

Следует по edge с `label` совпадающему с `handle`.

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

Трекает итерации в `context.flow_variables["nodes.{id}.currentIteration"]`. Возвращает `status: "async"` пока не достигнет `maxIterations`. Требует внешних вызовов `handleNodeCompleted` для каждой итерации.

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

Следует по edges с `label` совпадающему с branch id.

### join

```typescript
{
  type: "join",
  data: {
    mode: "all"  // all | any | n_of_m
  }
}
```

Агрегирует результаты веток.

### action

```typescript
{
  type: "action",
  data: {
    action: "send_email",
    to: "{{trigger.email}}"
  }
}
```

Если registered handler — выполняет sync. Если нет — возвращает `status: "async"` и ждёт `handleNodeCompleted`.

### delay

```typescript
{
  type: "delay",
  data: {
    seconds: 30
  }
}
```

Пауза. Минимум 1 секунда.

### input

Возвращает входные данные триггера. Поддерживает оба варианта:
- `trigger_data.inputs.name` → читает из `trigger_data.inputs`
- `trigger_data.name` → читает из `trigger_data` напрямую

### output

```typescript
{
  type: "output",
  data: {
    outputs: {
      tag: "{{nodes.n3.output.result}}"
    }
  }
}
```

Резолвит templates и возвращает resolved outputs.

### subflow

```typescript
{
  type: "subflow",
  data: {
    flow_id: "other-flow-id"
  }
}
```

Создаёт вложенный run. Возвращает `status: "async"`. Требует `handleNodeCompleted`.

## Backpressure

Опциональные лимиты на количество параллельных и ожидающих run'ов.

```typescript
await edem.flows.createFlow({
  name: "Rate-limited Flow",
  trigger: { type: "manual" },
  backpressure: {
    maxConcurrent: 3,  // максимум running + waiting
    maxPending: 2,     // максимум waiting
  },
  nodes: [...],
  edges: [...],
})
```

При превышении лимита `runFlow` выбрасывает ошибку.

## Экспорты

```typescript
import {
  flowsModule,        // основной модуль
  registerAction,     // регистрация action handlers
  startScheduler,     // запуск schedule триггеров
  startDispatcher,    // запуск event/webhook триггеров
  parseEvery,         // парсинг "15m" → миллисекунды
  matchesSchedule,    // проверка расписания
  validateFlow,       // валидация структуры flow
  type FlowsManifest,
  type FlowManifest,
  type ActionHandler,
  type ScheduleTrigger,
  type DayOfWeek,
} from "@exodus/edem-flows"
```

### registerAction

```typescript
import { registerAction } from "@exodus/edem-flows"

registerAction("checkUpdate", async (input, context) => {
  // обработка
  return { updated: true }
})
```

### startScheduler

```typescript
import { startScheduler } from "@exodus/edem-flows"

const scheduler = await startScheduler(flowsAPI, dataAPI)

// Остановка
scheduler.stop()
```

Запускает таймеры для flows с `schedule` триггером. Подписывается на создание/обновление/удаление flows. Возвращает `{ stop() }` для остановки.

### startDispatcher

```typescript
import { startDispatcher } from "@exodus/edem-flows"

const { emit, triggerWebhook } = await startDispatcher(flowsAPI, dataAPI)
```

Создаёт индексы event и webhook триггеров. Слушает события `itemCreated`/`itemUpdated`/`itemDeleted` от data модуля.

- `emit(name, payload)` — триггер event-based flows
- `triggerWebhook(path, payload)` — триггер webhook-based flows

### parseEvery

```typescript
import { parseEvery } from "@exodus/edem-flows"

parseEvery("15m")  // 900000
parseEvery("2h")   // 7200000
parseEvery("1d")   // 86400000
parseEvery("1w")   // 604800000
```

### matchesSchedule

```typescript
import { matchesSchedule } from "@exodus/edem-flows"

const trigger = { type: "schedule" as const, every: "1h", at: "09:00", days: ["mon", "tue"] }
matchesSchedule(trigger, new Date()) // boolean
```

### validateFlow

```typescript
import { validateFlow } from "@exodus/edem-flows"

const result = validateFlow(flow)
if (!result.valid) {
  console.error(result.errors)
}
// Проверяет: edges ссылаются на существующие ноды
```

## Пример

```typescript
import { createEdem } from "@exodus/edem-core"
import { dataModule } from "@exodus/edem-data"
import { flowsModule, registerAction, startScheduler, startDispatcher } from "@exodus/edem-flows"

const edem = createEdem([dataModule, flowsModule])

// Регистрация action handlers
registerAction("checkUpdate", async () => {
  console.log("Checking for updates...")
  return { updated: false }
})

// Запуск scheduler и dispatcher
const scheduler = await startScheduler(edem.flows, edem.data)
const { emit } = await startDispatcher(edem.flows, edem.data)

// Создание flow
const { flow_id } = await edem.flows.createFlow({
  name: "Auto-tag Items",
  trigger: { type: "event", event: "item:created:games" },
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

// Эмит события (триггерит flows с event триггером)
emit("item:created:games", { id: "1", genre: "RPG", title: "Elden Ring" })
```
