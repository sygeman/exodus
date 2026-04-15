# Слой описания схемы (`schema.ts`)

Файл `schema.ts` в папке модуля декларативно описывает его события.

---

## Структура

### `mutations`

События, изменяющие состояние.

```typescript
mutations: {
  increment: { schema: z.void() },
  setLevel: { schema: z.object({ level: z.enum(["debug", "info", "error"]) }) },
}
```

- `schema` — обязательно. Бизнес-payload мутации.

### `queries`

Запросы данных.

```typescript
queries: {
  getState: {
    schema: z.void(),
    response: z.object({ count: z.number() }),
  },
}
```

- `schema` — обязательно. Input payload запроса.
- `response` — обязательно. Схема возвращаемых данных.

### `subscriptions`

Исходящие события модуля.

```typescript
subscriptions: {
  updated: { schema: z.object({ count: z.number() }) },
  entry: { schema: z.object({ level: z.string(), message: z.string() }) },
}
```

- `schema` — обязательно. Схема payload события, которое эмитится.

---

## Примеры

### Counter

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

### Logger

```typescript
// logger/schema.ts
export default {
  mutations: {
    setLevel: {
      schema: z.object({ level: z.enum(["debug", "info", "warn", "error"]) }),
    },
    clear: {
      schema: z.object({ source: z.string() }),
    },
  },
  queries: {
    list: {
      schema: z.object({ level: z.string().optional(), limit: z.number().optional() }),
      response: z.object({ logs: z.array(z.any()), total: z.number() }),
    },
    getStats: {
      schema: z.void(),
      response: z.object({ byLevel: z.record(z.number()) }),
    },
  },
  subscriptions: {
    entry: {
      schema: z.object({ level: z.string(), message: z.string(), timestamp: z.number() }),
    },
  },
}
```

### App State

```typescript
// app-state/schema.ts
export default {
  mutations: {
    saveSettings: {
      schema: z.object({ theme: z.enum(["light", "dark"]).optional() }),
    },
    routeChanged: {
      schema: z.object({ hash: z.string() }),
    },
  },
  subscriptions: {
    routeChanged: {
      schema: z.object({ hash: z.string() }),
    },
  },
}
```
