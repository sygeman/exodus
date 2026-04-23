# Edem Core

## Обзор

Edem runtime core — система модулей и внутренняя шина событий.

Этот пакет предоставляет базовую инфраструктуру для платформы Edem:
- **Event Bus** — внутренняя межмодульная коммуникация (скрыта от модулей)
- **Module System** — регистрация модулей, lifecycle, агрегация API
- **Plugin Architecture** — модули общаются только через события, без прямых импортов

## Архитектура

```
┌─────────────────────────────────────────┐
│              Класс Edem                 │
│  ┌─────────────────────────────────┐    │
│  │         API модулей             │    │
│  │  edem.data.createCollection()   │    │
│  │  edem.flows.createFlow()        │    │
│  │  edem.ui.createPage()           │    │
│  └─────────────────────────────────┘    │
│  ┌─────────────────────────────────┐    │
│  │      Внутренняя шина событий    │    │
│  │  (скрыта от публичного API)     │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

## Принципы проектирования

### 1. Event-Driven внутри

Модули общаются **только через события**. Прямые импорты между модулями запрещены (`@/modules/<другой-модуль>` нельзя).

Но шина событий **внутренняя**. Пользователи и модули видят типизированное API, а не сырые события.

### 2. API появляется после регистрации

До регистрации:
```typescript
const edem = new Edem("bun")
// edem.data === undefined
```

После регистрации:
```typescript
edem.register(dataModule)
// edem.data.createCollection(...) — теперь доступно
```

### 3. Модуль = Функция

Модуль — это функция, получающая `Edem` и регистрирующая своё API:

```typescript
function dataModule(edem: Edem) {
  // Регистрация обработчиков событий (внутреннее)
  edem.on("data:create_collection", handleCreateCollection)
  
  // Экспорт публичного API
  edem.data = {
    createCollection: async (params) => {
      return edem.request("data:create_collection", params)
    },
    getCollection: async (id) => {
      return edem.request("data:get_collection", { id })
    }
  }
}
```

### 4. Типобезопасность

TypeScript знает какие API доступны после регистрации:

```typescript
const edem = new Edem("bun")
  .register(dataModule)
  .register(flowsModule)

// edem.data — типизировано
// edem.flows — типизировано
```

## Публичный API

### `new Edem(environment)`

Создаёт runtime Edem.

```typescript
const edem = new Edem("bun")
```

### `edem.register(module)`

Регистрирует модуль. Возвращает `Edem` для чейнинга.

```typescript
edem.register(dataModule)
edem.register(flowsModule)

// Или чейнинг:
const edem = new Edem("bun")
  .register(dataModule)
  .register(flowsModule)
```

### API модулей

После регистрации API модуля доступно по адресу `edem.<имяМодуля>`:

```typescript
// Data модуль
edem.data.createCollection({ name: "Games" })
edem.data.getCollection("games")
edem.data.createItem({ collectionId: "games", data: { title: "Elden Ring" } })

// Flows модуль
edem.flows.createFlow({ name: "Auto-tag", trigger: "event" })
edem.flows.runFlow("flow-id")

// UI модуль
edem.ui.createPage({ name: "Games", route: "/games" })
edem.ui.renderPage("page-id")
```

## Реализация модуля

### Базовый модуль

```typescript
function dataModule(edem: Edem) {
  // Внутреннее состояние
  const collections = new Map()
  
  // Регистрация обработчиков событий
  edem.handle("data:create_collection", (ctx) => {
    const id = crypto.randomUUID()
    collections.set(id, ctx.payload)
    return { id }
  })
  
  // Экспорт публичного API
  edem.data = {
    createCollection: (params) => edem.request("data:create_collection", params),
    getCollection: (id) => edem.request("data:get_collection", { id })
  }
}
```

### Модуль с межмодульным взаимодействием

```typescript
function dataModule(edem: Edem) {
  // Подписка на события от других модулей
  edem.on("flows:run_completed", (ctx) => {
    // Обновить данные когда flow завершился
  })
  
  // Отправка событий для других модулей
  edem.emit("data:collection_created", { id, name })
}
```

## Система событий (внутренняя)

### Именование событий

- **Команды**: `{модуль}:{действие}` — входящие запросы (`data:create-collection`)
- **Факты**: `{модуль}:{сущность}-{результат}` — исходящие уведомления (`data:collection-created`)
- **Ошибки**: `{модуль}:error` — структурированные ошибки

### Формат события

```typescript
{
  source: string,     // "{origin}:{id}"
  depth: number,      // 0-25 (защита от зацикливания)
  trace_id: string,   // UUID связывающий цепочку событий
  timestamp: number   // Unix ms
}
```

## Границы модулей

### Разрешено
- Внутри одного модуля (`./`, `../`)
- Сторонние пакеты
- Edem core (`@exodus/edem-core`)

### Запрещено
- `from "@/modules/<другой-модуль>"`
- Прямой доступ к состоянию других модулей

## Core модули

| Модуль | Описание |
|--------|-------------|
| `data` | Коллекции, поля, элементы, файлы |
| `ui` | Страницы, компоненты, привязки |
| `flows` | Рабочие процессы, триггеры |
| `tasks` | Очередь задач |
| `runners` | Исполнители |
| `settings` | Глобальные настройки |
| `notifications` | Пользовательские уведомления |
| `metrics` | Статистика выполнения |
| `events` | Лог событий |
| `mcp` | MCP шлюз |

## Пример: полная настройка

```typescript
import { Edem } from "@exodus/edem-core"
import { dataModule } from "@exodus/edem-data"
import { flowsModule } from "@exodus/edem-flows"
import { uiModule } from "@exodus/edem-ui"

const edem = new Edem("bun")
  .register(dataModule)
  .register(flowsModule)
  .register(uiModule)

// Использование API
const collection = await edem.data.createCollection({ name: "Games" })
const page = await edem.ui.createPage({ 
  name: "Games", 
  route: "/games",
  collectionId: collection.id 
})
```
