# Edem Data Engine

## Overview

The foundation of the Edem system. Stores all user data: collections, items, files, templates.

Reference: **Directus**

## Concepts

### Collection

A table in the database. User creates collections through a constructor.

```typescript
type Collection = {
  id: string
  name: string
  slug: string
  fields: Field[]
  meta?: object
}
```

### Field

A column in a collection. Has a type that defines behavior.

```typescript
type Field = {
  id: string
  collection_id: string
  name: string
  type: FieldType
  options?: object
  required?: boolean
  default?: unknown
  meta?: object
}
```

### Item

A row in a collection. Stores actual data.

```typescript
type Item = {
  id: string
  collection_id: string
  data: object
  created_at: number
  updated_at: number
}
```

## Field Types

### Basic Types

| Type | Storage | Description |
|------|---------|-------------|
| `string` | TEXT | Single-line text |
| `text` | TEXT | Multi-line text |
| `number` | REAL | Integer or float |
| `boolean` | INTEGER | 0 or 1 |
| `date` | TEXT | ISO 8601 date |
| `datetime` | TEXT | ISO 8601 datetime |
| `json` | TEXT | JSON object/array |

### Media Types

| Type | Storage | Description |
|------|---------|-------------|
| `file` | TEXT (hash) | Reference to file in storage |
| `image` | TEXT (hash) | Image with variants |
| `video` | TEXT (hash) | Video with thumbnails |

### Relation Types

| Type | Storage | Description |
|------|---------|-------------|
| `relation` | TEXT | Many-to-one to another collection |
| `collection` | — | Virtual, defines child collection |

### Special Types

| Type | Storage | Description |
|------|---------|-------------|
| `uuid` | TEXT | Auto-generated UUID |
| `timestamp` | INTEGER | Auto-generated timestamp |
| `user` | TEXT | Current user (for multi-user future) |
| `sort` | INTEGER | Manual sort order |

## Events

### Commands

```typescript
data:create_collection → data:collection_created
data:update_collection → data:collection_updated
data:delete_collection → data:collection_deleted
data:create_item → data:item_created
data:update_item → data:item_updated
data:delete_item → data:item_deleted
data:query_items → data:items_result
```

## File Storage

Content-addressable storage based on SHA256 hash.

```
files/
├── ab/
│   └── cd/
│       └── ef1234567890abcdef...
└── 12/
    └── 34/
        └── 567890abcdef1234...
```

## Documentation

- [Data Layer](./docs/data.md) — Full data layer specification
