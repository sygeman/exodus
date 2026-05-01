# Edem Data

Data модуль для Edem — коллекции, элементы, CRUD операции.

## Установка

```typescript
import { dataModule } from "@exodus/edem-data"
import { createEdem } from "@exodus/edem-core"

const edem = createEdem([dataModule])
```

## Схемы

### Collection

```typescript
import { collectionSchema } from "@exodus/edem-data"

// { id, name, slug, fields, meta? }
```

### Field

```typescript
import { fieldSchema } from "@exodus/edem-data"

// { id, collection_id, name, type, options?, required?, default?, meta? }
```

### Item

```typescript
import { itemSchema } from "@exodus/edem-data"

// { id, collection_id, data, created_at, updated_at }
```

## API

### Mutations

#### `createCollection`

```typescript
const { id } = await edem.data.createCollection({
  name: "Games",
  slug: "games",
  fields: [],    // optional
  meta: {},      // optional
})
```

#### `updateCollection`

```typescript
const { id } = await edem.data.updateCollection({
  collection_id: "...",
  name: "New Name",   // optional
  slug: "new-slug",   // optional
  fields: [],          // optional
  meta: {},            // optional
})
```

#### `deleteCollection`

```typescript
const { success } = await edem.data.deleteCollection({
  collection_id: "...",
})
```

#### `createItem`

```typescript
const { id } = await edem.data.createItem({
  collection_id: "...",
  data: { title: "Elden Ring", rating: 10 },
})
```

#### `updateItem`

```typescript
const { id } = await edem.data.updateItem({
  item_id: "...",
  data: { title: "Updated Title" },  // merged with existing data
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
  filter: {},      // optional, reserved
  sort: [],        // optional, reserved
  limit: 10,       // optional
  offset: 0,       // optional
})
```

### Subscriptions

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

// Подписка на события
edem.data.collectionCreated(async ({ event }) => {
  console.log("Created:", event.name)
})

// Создание коллекции
const { id } = await edem.data.createCollection({
  name: "Games",
  slug: "games",
})

// Создание элемента
await edem.data.createItem({
  collection_id: id,
  data: { title: "Elden Ring" },
})

// Запрос элементов
const { items } = await edem.data.queryItems({ collection_id: id })
```

## Видение

Полная спецификация модуля данных: [docs/data.md](./docs/data.md)
