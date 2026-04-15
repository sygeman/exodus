# Интеграция Evento с Electrobun

Evento работает в архитектуре Electrobun как единый type-safe event bus между двумя окружениями: **bun** (main process) и **webview** (UI). Каждое окружение имеет свой экземпляр `Evento`, а передача событий между ними происходит через RPC Electrobun.

---

## Архитектура

```
┌─────────────┐     RPC (electrobun)      ┌─────────────┐
│     bun     │  ◄────────────────────►   │   webview   │
│  Evento     │   messages.emit(name,     │  Evento     │
│  "bun"      │   payload, meta)          │  "webview"  │
└─────────────┘                           └─────────────┘
```

- **bun** — имеет полный доступ к системе (файловая система, БД, сеть)
- **webview** — sandboxed, только UI-логика
- События передаются прозрачно: вызывающий не знает, где находится обработчик

---

## API интеграции

### Bun side

```typescript
import { BrowserWindow } from "electrobun/bun"
import { createEventoBun } from "@/bun/evento"

const { evento, rpc, setSender } = createEventoBun()

const { webview } = new BrowserWindow({
  title: "Exodus",
  url: "views://mainview/index.html",
  frame: { width: 1200, height: 800 },
  rpc,
})

// Подключаем sender: события без локальных слушателей уходят в webview
setSender(webview)
```

**Сигнатура `createEventoBun`:**

```typescript
function createEventoBun(): {
  evento: Evento<"bun", ["webview"]>
  rpc: RPCSchema<{ messages: { emit: { name: string; payload: unknown; meta: EventoMeta } } }>
  setSender(webview: BrowserWindow | BrowserView): void
}
```

### Webview side

```typescript
import { Electroview } from "electrobun/view"
import { createEventoWebview } from "@/mainview/evento"

const { evento, rpc } = createEventoWebview()
```

**Сигнатура `createEventoWebview`:**

```typescript
function createEventoWebview(): {
  evento: Evento<"webview", ["bun"]>
  rpc: RPCSchema<{ messages: { emit: { name: string; payload: unknown; meta: EventoMeta } } }>
}
```

---

## Регистрация модулей

Модуль состоит из `schema.ts` и `handle.ts`. Регистрация происходит через `evento.module()`:

```typescript
import counterSchema from "@/modules/counter/schema"
import counterHandle from "@/modules/counter/handle"

evento.module("counter", counterSchema, counterHandle, {
  store: { count: 0, auto_increment: false },
})
```

**Сигнатура:**

```typescript
evento.module<N extends string, S extends Schema, H extends Handler<S>>(
  name: N,
  schema: S,
  handle: H,
  context?: { store?: Record<string, unknown> }
): void
```

После регистрации модуль становится доступен в публичном API:

```typescript
evento.query.counter.getState({ source: "page:mount" })
evento.mutation.counter.increment({ source: "user:click" })
evento.subscription.counter.updated({ source: "page:mount" }, { next: (data) => ... })
```

---

## Как работает передача между окружениями

### Query: Webview → Bun

```typescript
const data = await evento.query.counter.getState({ source: "page:mount" })
```

1. webview не имеет локального `query` handler для `counter:get-state`
2. `evento.sender` отправляет запрос в bun через RPC
3. bun выполняет `query.getState` из `counter/handle.ts`
4. bun возвращает ответ обратно в webview
5. `Promise` в webview резолвится с данными

### Mutation: Webview → Bun

```typescript
await evento.mutation.counter.increment({ source: "user:click_btn_increment" })
```

1. webview отправляет mutation в bun через RPC
2. bun выполняет `mutation.increment` из `counter/handle.ts`
3. handler эмитит `counter:updated` через `emit.updated(...)`
4. подписчики в bun и webview получают событие

### Subscription: Bun → Webview

```typescript
const unsubscribe = evento.subscription.counter.updated(
  { source: "page:mount" },
  {
    next: (data) => {
      count.value = data.count
    },
  },
)
```

1. подписка регистрируется локально в webview
2. когда bun эмитит `counter:updated`, событие уходит через RPC в webview
3. webview вызывает `handlers.next` для всех подписчиков

### Reaction

Реакции в `handle.ts` слушают события **других** модулей:

```typescript
// counter/handle.ts
export default {
  reaction: {
    timer: {
      tick: async ({ ctx, emit }) => {
        if (ctx.store.auto_increment) {
          ctx.store.count++
          emit.updated({ count: ctx.store.count, auto_increment: ctx.store.auto_increment })
        }
      },
    },
  },
}
```

Runtime автоматически подписывается на `"timer:tick"`. При срабатывании:

- `trace_id`, `source` и `depth` сохраняются от входящего события
- `emit` использует `forward` под капотом

---

## Модули в разных окружениях

### Counter

```
counter/
  schema.ts    # mutations, queries, subscriptions
  handle.ts    # business logic (только в bun)
```

```typescript
// counter/schema.ts
export default {
  mutations: {
    increment: { schema: z.void() },
    reset: { schema: z.void() },
    autoEnable: { schema: z.void() },
    autoDisable: { schema: z.void() },
  },
  queries: {
    getState: {
      schema: z.void(),
      response: z.object({ count: z.number(), auto_increment: z.boolean() }),
    },
  },
  subscriptions: {
    updated: {
      schema: z.object({ count: z.number(), auto_increment: z.boolean() }),
    },
  },
}
```

```typescript
// counter/handle.ts
export default {
  query: {
    getState: async ({ ctx }) => ({
      count: ctx.store.count,
      auto_increment: ctx.store.auto_increment,
    }),
  },
  mutation: {
    increment: async ({ ctx, emit }) => {
      ctx.store.count++
      emit.updated({ count: ctx.store.count, auto_increment: ctx.store.auto_increment })
    },
    reset: async ({ ctx, emit }) => {
      ctx.store.count = 0
      emit.updated({ count: ctx.store.count, auto_increment: ctx.store.auto_increment })
    },
    autoEnable: async ({ ctx, emit }) => {
      ctx.store.auto_increment = true
      emit.updated({ count: ctx.store.count, auto_increment: ctx.store.auto_increment })
    },
    autoDisable: async ({ ctx, emit }) => {
      ctx.store.auto_increment = false
      emit.updated({ count: ctx.store.count, auto_increment: ctx.store.auto_increment })
    },
  },
  reaction: {
    timer: {
      tick: async ({ ctx, emit }) => {
        if (ctx.store.auto_increment) {
          ctx.store.count++
          emit.updated({ count: ctx.store.count, auto_increment: ctx.store.auto_increment })
        }
      },
    },
  },
}
```

```typescript
// webview: Vue composable
export function useCounter() {
  const count = ref(0)
  const autoIncrement = ref(false)

  evento.subscription.counter.updated(
    { source: "page:mount" },
    {
      next: (data) => {
        count.value = data.count
        autoIncrement.value = data.auto_increment
      },
    },
  )

  onMounted(async () => {
    const state = await evento.query.counter.getState({ source: "page:mount" })
    count.value = state.count
    autoIncrement.value = state.auto_increment
  })

  const increment = () => {
    evento.mutation.counter.increment({ source: "user:click_btn_increment" })
  }

  return { count, autoIncrement, increment }
}
```

### Logger

```
logger/
  schema.ts    # shared
  handle.ts    # bun only
```

```typescript
// webview
const { logs, total } = await evento.query.logger.list({
  variables: { level: "error", limit: 10 },
  source: "user:search",
})

const unsubscribe = evento.subscription.logger.entry(
  { source: "page:mount" },
  {
    next: (entry) => {
      console.log(entry.message)
    },
  },
)
```

### App State

```typescript
// webview
await evento.mutation.appState.saveSettings({
  variables: { theme: "dark" },
  source: "user:preference",
})

const unsubscribe = evento.subscription.appState.routeChanged(
  { source: "page:mount" },
  {
    next: (data) => {
      currentRoute.value = data.hash
    },
  },
)
```

---

## Error Handling

### AppError

Все ошибки в Evento — структурированные `AppError`:

```typescript
class AppError extends Error {
  readonly code: string
  readonly message: string
  readonly messageKey?: string
  readonly messageArgs?: Record<string, unknown>
  readonly details?: Record<string, unknown>
  readonly cause?: AppError
}
```

### Query

```typescript
try {
  const data = await evento.query.counter.getState({ source: "user:init" })
} catch (error) {
  if (error instanceof AppError) {
    console.log(error.code) // "TIMEOUT" | "VALIDATION_ERROR" | ...
  }
}
```

### Mutation

```typescript
try {
  await evento.mutation.counter.increment({ source: "user:click" })
} catch (error) {
  if (error instanceof AppError) {
    console.log(error.code)
  }
}
```

### Subscription

```typescript
const unsubscribe = evento.subscription.counter.updated(
  { source: "page:mount" },
  {
    next: (data) => console.log(data.count),
    error: (error) => console.error(error.code),
  },
)
```

### Глобальный обработчик

```typescript
evento.onError((error, context) => {
  console.error(error.code, context.name, context.source)
})
```

### Cross-environment ошибки

- `TIMEOUT` — превышен таймаут ожидания ответа от другого окружения
- `VALIDATION_ERROR` — payload не прошёл валидацию схемы
- `DEPTH_EXCEEDED` — превышена максимальная глубина цепочки событий
- `HANDLER_ERROR` — необработанное исключение в handler

При cross-environment вызове `AppError` сериализуется и передаётся в вызывающее окружение.

---

## Жизненный цикл и HMR

### Dev mode

В dev-режиме webview загружается с `http://localhost:5173` (Vite HMR). При hot reload:

1. Webview перезагружается
2. `createEventoWebview()` создаёт новый экземпляр `Evento`
3. Bun-сторона не перезагружается, `store` модулей сохраняется
4. Webview может заново запросить состояние через `query`

### Production

```
views://mainview/index.html
```

В production webview загружается из bundled resources.

---

## Ограничения и правила

1. **Сериализация** — payload должен быть JSON-serializable (RPC Electrobun использует JSON)
2. **BigInt / Date / undefined** — не передаются напрямую, нужна явная сериализация в схеме
3. **Функции / классы** — не передаются через RPC
4. **Zod-схемы** — регистрируются при `evento.module()` в обоих окружениях
5. **Loop detection** — `MAX_EVENT_DEPTH = 25` работает и при cross-environment цепочках
6. **Query в другом окружении** — если handler найден локально, он выполняется локально; иначе — через RPC
7. **Mutation всегда в bun** — для stateful модулей `handle.ts` живёт в bun, webview только вызывает
8. **Subscription локальна** — подписка регистрируется в том окружении, где вызвана

---

## Типобезопасность

`evento.module()` генерирует типы для публичного API:

```typescript
// После evento.module("counter", counterSchema, counterHandle)

evento.query.counter.getState // (options) => Promise<{ count: number; auto_increment: boolean }>
evento.mutation.counter.increment // (options) => Promise<void>
evento.subscription.counter.updated // (options, handlers) => () => void
```

TypeScript проверяет:

- Корректность `variables` по `schema`
- Корректность return type `query`
- Корректность payload `subscription`
- Kebab-case для всех имён событий

---

## Event Naming Convention

- **Все события в kebab-case строго**
- Namespace события = имя модуля
- Примеры: `logger:entry`, `app-state:route-changed`, `updater:check-update`
- Свойства payload тоже в kebab-case
