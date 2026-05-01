# Edem Data

Data модуль для Edem — коллекции, элементы, CRUD операции, валидация, фильтрация.

## Установка

```typescript
import { dataModule } from "@exodus/edem-data"
import { createEdem } from "@exodus/edem-core"

const edem = createEdem([dataModule])
```

## Field Types

| Type | Описание | Пример значения |
|------|----------|-----------------|
| `string` | Однострочный текст | `"hello"` |
| `text` | Многострочный текст | `"line1\nline2"` |
| `number` | Число | `42`, `3.14` |
| `boolean` | Логическое | `true`, `false` |
| `date` | Дата ISO 8601 | `"2024-01-15"` |
| `datetime` | Дата+время ISO 8601 | `"2024-01-15T10:30:00"` |
| `json` | JSON объект/массив | `{ key: "value" }` |
| `file` | Файл (hash) | `"abc123..."` |
| `image` | Изображение (hash) | `"abc123..."` |
| `video` | Видео (hash) | `"abc123..."` |
| `relation` | Ссылка на другую коллекцию | `"item-id"` |
| `collection` | Виртуальный, дочерняя коллекция | — |
| `uuid` | UUID | `"550e8400-..."` |
| `timestamp` | Timestamp ISO 8601 | `"2024-01-15T10:30:00"` |
| `user` | Текущий пользователь | `"user-id"` |
| `sort` | Порядок сортировки | `1`, `2`, `3` |

## API

### Mutations

#### `createCollection`

```typescript
const { id } = await edem.data.createCollection({
  name: "Games",
  slug: "games",
  fields: [
    { id: "1", collection_id: "", name: "title", type: "string", required: true },
    { id: "2", collection_id: "", name: "rating", type: "number" },
  ],
  meta: {},
})
```

#### `updateCollection`

```typescript
const { id } = await edem.data.updateCollection({
  collection_id: "...",
  name: "New Name",
  slug: "new-slug",
  fields: [],
  meta: {},
})
```

#### `deleteCollection`

```typescript
const { success } = await edem.data.deleteCollection({
  collection_id: "...",
})
```

#### `createItem`

Валидирует данные по схеме полей коллекции.

```typescript
const { id } = await edem.data.createItem({
  collection_id: "...",
  data: { title: "Elden Ring", rating: 10 },
})
```

#### `updateItem`

Валидирует обновляемые поля.

```typescript
const { id } = await edem.data.updateItem({
  item_id: "...",
  data: { title: "Updated Title" },
})
```

#### `deleteItem`

```typescript
const { success } = await edem.data.deleteItem({
  item_id: "...",
})
```

### Queries

#### `getCollection`

```typescript
const { collection } = await edem.data.getCollection({
  collection_id: "...",
})
// collection | null
```

#### `listCollections`

```typescript
const { collections } = await edem.data.listCollections()
// Collection[]
```

#### `getItem`

```typescript
const { item } = await edem.data.getItem({
  item_id: "...",
})
// item | null
```

#### `queryItems`

```typescript
const { items, total } = await edem.data.queryItems({
  collection_id: "...",
  filter: { status: { _eq: "published" } },
  sort: ["-created_at"],
  limit: 10,
  offset: 0,
})
```

## Query Language

### Фильтры

| Оператор | Описание | Пример |
|----------|----------|--------|
| `_eq` | Равно | `{ status: { _eq: "published" } }` |
| `_neq` | Не равно | `{ status: { _neq: "draft" } }` |
| `_gt` | Больше | `{ price: { _gt: 10 } }` |
| `_gte` | Больше или равно | `{ price: { _gte: 10 } }` |
| `_lt` | Меньше | `{ price: { _lt: 100 } }` |
| `_lte` | Меньше или равно | `{ price: { _lte: 100 } }` |
| `_contains` | Содержит строку | `{ title: { _contains: "hello" } }` |
| `_starts_with` | Начинается с | `{ name: { _starts_with: "A" } }` |
| `_ends_with` | Заканчивается на | `{ name: { _ends_with: "z" } }` |
| `_in` | В массиве | `{ category: { _in: ["books", "movies"] } }` |
| `_between` | Между | `{ price: { _between: [10, 100] } }` |

### Логические операторы

```typescript
// AND
filter: {
  _and: [
    { status: { _eq: "published" } },
    { price: { _gt: 10 } }
  ]
}

// OR
filter: {
  _or: [
    { category: { _eq: "books" } },
    { category: { _eq: "movies" } }
  ]
}
```

### Сортировка

```typescript
// По возрастанию
sort: ["price"]

// По убыванию
sort: ["-price"]

// Несколько полей
sort: ["category", "-price"]
```

### Пагинация

```typescript
// Первая страница
limit: 10, offset: 0

// Вторая страница
limit: 10, offset: 10
```

## Subscriptions

#### `collectionCreated`

```typescript
edem.data.collectionCreated(async ({ event }) => {
  console.log(event.id, event.name, event.slug)
})
```

#### `collectionUpdated`

```typescript
edem.data.collectionUpdated(async ({ event }) => {
  console.log(event.id, event.name)
})
```

#### `collectionDeleted`

```typescript
edem.data.collectionDeleted(async ({ event }) => {
  console.log(event.collection_id)
})
```

#### `itemCreated`

```typescript
edem.data.itemCreated(async ({ event }) => {
  console.log(event.id, event.data)
})
```

#### `itemUpdated`

```typescript
edem.data.itemUpdated(async ({ event }) => {
  console.log(event.id, event.data)
})
```

#### `itemDeleted`

```typescript
edem.data.itemDeleted(async ({ event }) => {
  console.log(event.item_id, event.collection_id)
})
```

## Пример

```typescript
import { createEdem } from "@exodus/edem-core"
import { dataModule } from "@exodus/edem-data"

const edem = createEdem([dataModule])

// Создание коллекции с полями
const { id } = await edem.data.createCollection({
  name: "Games",
  slug: "games",
  fields: [
    { id: "1", collection_id: "", name: "title", type: "string", required: true },
    { id: "2", collection_id: "", name: "rating", type: "number" },
    { id: "3", collection_id: "", name: "status", type: "string" },
  ],
})

// Создание элементов
await edem.data.createItem({ collection_id: id, data: { title: "Elden Ring", rating: 10, status: "published" } })
await edem.data.createItem({ collection_id: id, data: { title: "Dark Souls", rating: 9, status: "published" } })
await edem.data.createItem({ collection_id: id, data: { title: "Sekiro", rating: 8, status: "draft" } })

// Запрос с фильтрацией, сортировкой, пагинацией
const { items, total } = await edem.data.queryItems({
  collection_id: id,
  filter: { status: { _eq: "published" } },
  sort: ["-rating"],
  limit: 10,
  offset: 0,
})

// Подписка на события
edem.data.itemCreated(async ({ event }) => {
  console.log("New item:", event.data.title)
})
```

## Видение

Полная спецификация модуля данных: [docs/data.md](./docs/data.md)
