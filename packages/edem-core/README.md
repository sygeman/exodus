# Edem Core

## Обзор

Edem runtime core — типизированная система модулей с внутренней шиной событий.

Этот пакет предоставляет:
- **Module System** — создание модулей через builder паттерн
- **Procedures** — query (чтение), mutation (запись), subscription (события)
- **Event Bus** — внутренняя межмодульная коммуникация (скрыта от модулей)
- **Type Safety** — полная типизация через Zod схемы

## Архитектура

```
┌─────────────────────────────────────────────────────┐
│                    createEdem()                      │
│                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │  dataModule  │  │ flowsModule  │  │  uiModule  │ │
│  │              │  │              │  │            │ │
│  │ .query()     │  │ .mutation()  │  │ .query()   │ │
│  │ .mutation()  │  │ .subscription│  │ .mutation()│ │
│  │ .subscription│  │              │  │            │ │
│  └──────────────┘  └──────────────┘  └────────────┘ │
│                                                     │
│  Внутренняя шина событий (скрыта)                   │
└─────────────────────────────────────────────────────┘
```

## Публичный API

### `createEdemModule(name, register, react?)`

Создаёт модуль.

```typescript
import { createEdemModule } from "@exodus/edem-core"
import { z } from "zod"

const dataModule = createEdemModule(
  "data",
  (module) => {
    return module
      .context(async () => ({
        store: new Map<string, { id: string; name: string }>(),
      }))
      .subscription("collectionCreated", {
        output: z.object({ id: z.string(), name: z.string() }),
      })
      .mutation("createCollection", {
        input: z.object({ name: z.string() }),
        output: z.object({ id: z.string() }),
        resolve: async ({ input, ctx, emit }) => {
          const id = crypto.randomUUID()
          ctx.store.set(id, { id, name: input.name })
          await emit.collectionCreated({ id, name: input.name })
          return { id }
        },
      })
      .query("getCollection", {
        input: z.object({ id: z.string() }),
        output: z.object({ collection: z.object({ id: z.string(), name: z.string() }).nullable() }),
        resolve: async ({ input, ctx }) => {
          return { collection: ctx.store.get(input.id) ?? null }
        },
      })
  },
  // react — опциональная функция для межмодульного взаимодействия
  (edem) => {
    edem.flows.flowCompleted(async ({ event }) => {
      await edem.data.createCollection({ name: `flow-${event.name}` })
    })
  },
)
```

**Параметры:**
- `name` — имя модуля (становится ключом в `edem.<name>`)
- `register` — builder callback, возвращает `ModuleBuilder` с цепочкой вызовов
- `react` — опциональная функция, вызывается после регистрации всех модулей

### `createEdem(modules)`

Собирает модули в единый объект `edem`.

```typescript
import { createEdem } from "@exodus/edem-core"

const edem = createEdem([dataModule, flowsModule, uiModule])

// Использование API
await edem.data.createCollection({ name: "Games" })
await edem.flows.runFlow({ name: "sync" })
await edem.ui.createPage({ name: "Home", route: "/" })
```

### `ModuleBuilder`

Fluent API для определения процедур модуля.

| Метод | Описание |
|-------|----------|
| `.context(fn)` | Задаёт async фабрику контекста. Контекст ленивый, кэшируется. |
| `.subscription(name, def)` | Объявляет канал событий. `def.output` — Zod схема payload. |
| `.mutation(name, def)` | Объявляет мутацию. `def.input`, `def.output` — Zod схемы, `def.resolve` — обработчик. |
| `.query(name, def)` | Объявляет запрос. `def.input`, `def.output` — Zod схемы, `def.resolve` — обработчик. |

### `EdemError`

Класс ошибок, выбрасывается при ошибках регистрации или инициализации реакций.

```typescript
import { EdemError } from "@exodus/edem-core"

try {
  createEdem([brokenModule])
} catch (e) {
  if (e instanceof EdemError) {
    console.error(e.message, e.cause)
  }
}
```

## Procedures

### Query (чтение)

```typescript
.query("getCollection", {
  input: z.object({ id: z.string() }),
  output: z.object({ collection: collectionSchema.nullable() }),
  resolve: async ({ input, ctx }) => {
    return { collection: ctx.store.get(input.id) ?? null }
  },
})
```

### Mutation (запись)

```typescript
.mutation("createCollection", {
  input: z.object({ name: z.string() }),
  output: z.object({ id: z.string() }),
  resolve: async ({ input, ctx, emit }) => {
    const id = crypto.randomUUID()
    ctx.store.set(id, { id, name: input.name })
    await emit.collectionCreated({ id, name: input.name })
    return { id }
  },
})
```

### Subscription (события)

```typescript
.subscription("collectionCreated", {
  output: z.object({ id: z.string(), name: z.string() }),
})
```

Подписка извне:

```typescript
edem.data.collectionCreated(async ({ event }) => {
  console.log("Created:", event.name)
})
```

## Межмодульное взаимодействие

Модули общаются через `react` callback, который вызывается после регистрации всех модулей:

```typescript
const collectionModule = createEdemModule(
  "collection",
  (module) => { /* ... */ },
  (edem) => {
    // Подписываемся на события другого модуля
    edem.flows.flowCompleted(async ({ event }) => {
      await edem.collection.createCollection({ name: `flow-${event.name}` })
    })
  },
)
```

## Пример: полная настройка

```typescript
import { createEdem } from "@exodus/edem-core"
import { dataModule } from "@exodus/edem-data"
import { flowsModule } from "@exodus/edem-flows"
import { uiModule } from "@exodus/edem-ui"

const edem = createEdem([dataModule, flowsModule, uiModule])

// Мутации
const { id } = await edem.data.createCollection({ name: "Games", slug: "games" })
await edem.data.createItem({ collection_id: id, data: { title: "Elden Ring" } })

// Запросы
const { collections } = await edem.data.listCollections()
const { items } = await edem.data.queryItems({ collection_id: id })

// Подписки
edem.data.collectionCreated(async ({ event }) => {
  console.log("New collection:", event.name)
})
```

## Границы модулей

### Разрешено
- Внутри одного модуля (`./`, `../`)
- Сторонние пакеты
- `@exodus/edem-core`

### Запрещено
- Прямые импорты между модулями
- Прямой доступ к состоянию других модулей
