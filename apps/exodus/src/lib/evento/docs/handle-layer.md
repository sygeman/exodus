# Слой обработки (`handle.ts`)

Файл `handle.ts` в папке модуля содержит бизнес-логику: обработчики `query`, `mutation` и `reaction`.  
`subscription` в `handle.ts` не описывается — подписки регистрируются динамически через публичный API.

---

## Структура

```typescript
export default {
  query: {
    getState: async ({ ctx }) => ({ count: 0 }),
  },
  mutation: {
    increment: async ({ ctx, emit }) => {
      // ...
      emit.updated({ count: 1 })
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

---

## Query

Запрашивает данные. Должен вернуть значение, соответствующее `response`-схеме.

```typescript
query: {
  getState: async ({ variables, ctx }) => {
    return { count: ctx.store.count }
  },
}
```

**Сигнатура:**

```typescript
;({ variables, ctx }: { variables: V; ctx: ModuleContext }) => Promise<R>
```

**Поля:**

- `variables` — данные, прошедшие валидацию по `schema`
- `ctx` — контекст модуля

**Ошибки:**

- Любое необработанное исключение оборачивается в `AppError` с кодом `HANDLER_ERROR`
- Возвращаемое значение валидируется по `response`-схеме

---

## Mutation

Изменяет состояние. Возвращает `Promise<void>`.

```typescript
mutation: {
  increment: async ({ variables, ctx, emit }) => {
    ctx.store.count++
    emit.updated({ count: ctx.store.count })
  },
}
```

**Сигнатура:**

```typescript
;({
  variables,
  ctx,
  emit,
}: {
  variables: V
  ctx: ModuleContext
  emit: {
    [K in keyof Subscriptions]: (payload: Subscriptions[K]) => void
  }
}) => Promise<void>
```

**Поля:**

- `variables` — данные, прошедшие валидацию по `schema`
- `ctx` — контекст модуля
- `emit` — функция для эмита событий модуля

**Ошибки:**

- Любое необработанное исключение оборачивается в `AppError` с кодом `HANDLER_ERROR`

**Примечание:** `emit` доступен только внутри `mutation`. `query` не должен эмитить события — это нарушение семантики чтения.

---

## Reaction

Реакции модуля на события **других** модулей.

```typescript
reaction: {
  timer: {
    tick: async ({ ctx, emit }) => {
      if (ctx.store.auto_increment) {
        ctx.store.count++
        emit.updated({ count: ctx.store.count, auto_increment: ctx.store.auto_increment })
      }
    },
  },
  system: {
    resume: async ({ emit }) => {
      emit('init', { count: 0, auto_increment: false })
    },
  },
}
```

**Сигнатура:**

```typescript
({ ctx, emit }: {
  ctx: ModuleContext
  emit: {
    [K in keyof Subscriptions]: (payload: Subscriptions[K]) => void
  }
}) => Promise<void> | void
```

**Поля:**

- `ctx` — контекст модуля
- `emit` — функция для эмита subscription-событий модуля

**Правила:**

- `reaction` слушает только **внешние** события (других модулей). События своего модуля обрабатываются в `query`/`mutation`
- Ключ первого уровня — имя модуля-источника, ключ второго уровня — имя события. Runtime мапит `timer: { tick: ... }` → подписка на `"timer:tick"`
- Пользователь пишет `emit`, а runtime под капотом использует `forward` для сохранения `trace_id`, `source` и инкремента `depth` от входящего события

**Ошибки:**

- Любое необработанное исключение оборачивается в `AppError` с кодом `HANDLER_ERROR` и эмитится в `evento:error`

---

## Контекст модуля (`ctx`)

`ctx` передаётся в каждый handler и содержит зависимости, инициализированные при создании модуля.

```typescript
type ModuleContext = {
  // Пример для counter
  store: { count: number; auto_increment: boolean }
}
```

Контекст создаётся один раз при регистрации модуля и переиспользуется во всех вызовах.

---

## Примеры по модулям

### Counter

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
      emit.updated({
        count: ctx.store.count,
        auto_increment: ctx.store.auto_increment,
      })
    },
    reset: async ({ ctx, emit }) => {
      ctx.store.count = 0
      emit.updated({
        count: ctx.store.count,
        auto_increment: ctx.store.auto_increment,
      })
    },
    autoEnable: async ({ ctx, emit }) => {
      ctx.store.auto_increment = true
      emit.updated({
        count: ctx.store.count,
        auto_increment: ctx.store.auto_increment,
      })
    },
    autoDisable: async ({ ctx, emit }) => {
      ctx.store.auto_increment = false
      emit.updated({
        count: ctx.store.count,
        auto_increment: ctx.store.auto_increment,
      })
    },
    init: async ({ ctx, emit }) => {
      emit.updated({
        count: ctx.store.count,
        auto_increment: ctx.store.auto_increment,
      })
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
    system: {
      resume: async ({ emit }) => {
        emit.init({ count: 0, auto_increment: false })
      },
    },
  },
}
```

### Logger

```typescript
// logger/handle.ts
export default {
  query: {
    list: async ({ variables, ctx }) => {
      let logs = ctx.store.logs
      if (variables.level) {
        logs = logs.filter((log) => log.level === variables.level)
      }
      if (variables.limit) {
        logs = logs.slice(0, variables.limit)
      }
      return { logs, total: ctx.store.logs.length }
    },
    getStats: async ({ ctx }) => {
      const byLevel: Record<string, number> = {}
      for (const log of ctx.store.logs) {
        byLevel[log.level] = (byLevel[log.level] ?? 0) + 1
      }
      return { byLevel }
    },
  },
  mutation: {
    setLevel: async ({ variables, ctx }) => {
      ctx.store.level = variables.level
    },
    clear: async ({ variables, ctx }) => {
      ctx.store.logs = ctx.store.logs.filter((log) => log.source !== variables.source)
    },
  },
}
```

### App State

```typescript
// app-state/handle.ts
export default {
  mutation: {
    saveSettings: async ({ variables, ctx, emit }) => {
      Object.assign(ctx.store.settings, variables)
      emit.settingsSaved(ctx.store.settings)
    },
    routeChanged: async ({ variables, ctx, emit }) => {
      ctx.store.route = variables.hash
      emit.routeChanged({ hash: variables.hash })
    },
  },
}
```

---

## Error Handling

Все ошибки внутри `query` и `mutation` обрабатываются runtime:

- Необработанное исключение → `AppError` с кодом `HANDLER_ERROR`
- Невалидный `variables` → отклоняется до вызова handler (см. `schema-layer.md`)
- Невалидный return `query` → `AppError` с кодом `VALIDATION_ERROR`

Handler может самостоятельно бросить `AppError` для конкретного кода ошибки:

```typescript
mutation: {
  transfer: async ({ variables, ctx }) => {
    if (variables.amount > ctx.store.balance) {
      throw new AppError({
        code: 'INSUFFICIENT_FUNDS',
        message: 'Insufficient funds for transfer',
      })
    }
    // ...
  },
}
```
