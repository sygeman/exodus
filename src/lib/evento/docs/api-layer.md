# Публичный API Evento

API организован по аналогии с GraphQL: **query**, **mutation**, **subscription**. Каждая категория — отдельное пространство имён.

---

## Query

Запрашивает данные. Возвращает `Promise<R>`. При ошибке `throw AppError`.

```typescript
const data = await evento.query.counter.getState({ source: "user:init", timeout: 2000 })

const { logs, total } = await evento.query.logger.list({
  variables: { level: "error", limit: 10 },
  source: "user:search",
  timeout: 5000,
})
```

**Сигнатура:**

```typescript
evento.query.{module}.{method}(options: {
  variables?: V
  source: string
  timeout?: number
}): Promise<R>
```

**Поля:**

- `source` — обязательно. Уникальный идентификатор источника вызова
- `variables` — опционально. Бизнес-параметры запроса
- `timeout` — опционально. Таймаут ожидания ответа в миллисекундах

**Ошибки:**

- `TIMEOUT` — превышен таймаут ожидания ответа
- `VALIDATION_ERROR` — payload не прошёл валидацию схемы
- `DEPTH_EXCEEDED` — превышена максимальная глубина цепочки событий
- Любой `AppError`, эмитнутый обработчиком через `evento:error`

---

## Mutation

Изменяет состояние. Возвращает `Promise<void>`. При ошибке `throw AppError`.

```typescript
await evento.mutation.counter.increment({ source: "user:click_btn_increment" })
await evento.mutation.counter.autoEnable({ source: "user:toggle_auto" })
await evento.mutation.logger.clear({ variables: { source: "bun" }, source: "user:ui_action" })
```

**Сигнатура:**

```typescript
evento.mutation.{module}.{method}(options: {
  variables?: V
  source: string
}): Promise<void>
```

**Поля:**

- `source` — обязательно
- `variables` — опционально. Бизнес-параметры мутации

**Ошибки:**

- Те же, что и у query
- `HANDLER_ERROR` — необработанное исключение внутри mutation handler

**Примечание:** `await` не обязателен — можно вызвать fire-and-forget. В этом случае непойманная ошибка уйдёт в глобальный `evento.onError`.

---

## Subscription

Подписывается на поток событий. Возвращает функцию отписки.

```typescript
const unsubscribe = evento.subscription.counter.updated(
  { source: "page:mount" },
  {
    next: (data) => {
      console.log(data.count)
    },
    error: (error) => {
      console.error(error.code)
    },
  },
)
```

**Сигнатура:**

```typescript
evento.subscription.{module}.{eventName}(
  options: { source: string },
  handlers: {
    next: (data: P) => void
    error?: (error: AppError) => void
  }
): () => void
```

**Поля:**

- `source` — обязательно. Используется для трассировки подписки
- `handlers.next` — callback, вызываемый при каждом событии
- `handlers.error` — опциональный callback для обработки ошибок в потоке

**Возвращает:** функцию `unsubscribe`, при вызове которой подписка снимается

**Обратная совместимость:** допускается передача plain callback вместо объекта `handlers`:

```typescript
const unsubscribe = evento.subscription.counter.updated({ source: "page:mount" }, (data) =>
  console.log(data.count),
)
```

---

## Примеры по модулям

### Counter

```typescript
// mutation
await evento.mutation.counter.increment({ source: "user:click_btn_increment" })
await evento.mutation.counter.reset({ source: "user:click_btn_reset" })
await evento.mutation.counter.autoEnable({ source: "user:toggle_auto" })

// query
const data = await evento.query.counter.getState({ source: "page:mount" })

// subscription
const unsubscribe = evento.subscription.counter.updated(
  { source: "page:mount" },
  {
    next: (data) => {
      count.value = data.count
    },
  },
)
```

### Logger

```typescript
// mutation
await evento.mutation.logger.setLevel({ variables: { level: "error" }, source: "user:ui_action" })

// query
const { logs, total } = await evento.query.logger.list({
  variables: { limit: 50 },
  source: "user:search",
})
const stats = await evento.query.logger.getStats({ source: "user:open_stats" })

// subscription
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
// mutation
await evento.mutation.appState.saveSettings({
  variables: { theme: "dark" },
  source: "user:preference",
})
await evento.mutation.appState.routeChanged({
  variables: { hash: "#/settings" },
  source: "router:navigation",
})

// subscription
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

Все ошибки в Evento представлены структурированным `AppError`.

### AppError

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

При ошибке `throw AppError`. Обрабатывается через `try/catch`.

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

При ошибке `reject AppError`.

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

Ошибки потока направляются в `handlers.error`.

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
