# Data Layer — Vision

## Overview

The foundation of the Edem system. Stores all user data: collections, items, files, templates.

Reference: **Directus**

## Concepts

### Collection

A table in the database. User creates collections through a constructor.

```typescript
type Collection = {
  id: string          // Unique identifier
  name: string        // Display name
  slug: string        // URL-friendly name
  fields: Field[]     // Field definitions
  meta?: object       // UI hints, sort order, etc.
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
  options?: object    // Type-specific options
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
  data: object        // Field values
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
// Create collection
data:create_collection → data:collection_created

// Update collection
data:update_collection → data:collection_updated

// Delete collection
data:delete_collection → data:collection_deleted

// Create item
data:create_item → data:item_created

// Update item
data:update_item → data:item_updated

// Delete item
data:delete_item → data:item_deleted

// Query items
data:query_items → data:items_result
```

### Event Schemas

```typescript
// data:create_item
{
  collection_id: string,
  data: object,
  source: string,
  depth: number,
  trace_id: string,
  timestamp: number
}

// data:item_created
{
  item_id: string,
  collection_id: string,
  data: object,
  source: string,
  depth: number,
  trace_id: string,
  timestamp: number
}

// data:query_items
{
  collection_id: string,
  filter?: object,      // { field: { _eq: value } }
  sort?: string[],      // ["-created_at"]
  limit?: number,
  offset?: number,
  source: string,
  depth: number,
  trace_id: string,
  timestamp: number
}

// data:items_result
{
  items: Item[],
  total: number,
  source: string,
  depth: number,
  trace_id: string,
  timestamp: number
}
```

## File Storage

Content-addressable storage based on SHA256 hash.

```
files/
├── ab/
│   └── cd/
│       └── ef1234567890abcdef...  # Hash = abcdef123456...
└── 12/
    └── 34/
        └── 567890abcdef1234...    # Hash = 1234567890ab...
```

**Benefits:**
- Deduplication — same file stored once
- Immutable — hash never changes
- Cache-friendly — hash as cache key

## Dynamic Schema

Collections and fields are stored in the database itself (meta-tables).

```sql
-- Collections table
CREATE TABLE collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  meta TEXT -- JSON
);

-- Fields table
CREATE TABLE fields (
  id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  options TEXT, -- JSON
  required INTEGER DEFAULT 0,
  default_value TEXT,
  meta TEXT -- JSON
);

-- Items table (generic)
CREATE TABLE items (
  id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL,
  data TEXT NOT NULL, -- JSON
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

When a collection is created:
1. Insert into `collections` table
2. Create dedicated table for items (optional, for performance)
3. Or use generic `items` table with JSON data

## Query Language

Filter syntax inspired by Directus:

```typescript
// Equality
{ status: { _eq: "published" } }

// Comparison
{ age: { _gt: 18 } }
{ price: { _between: [10, 100] } }

// String
{ title: { _contains: "hello" } }
{ name: { _starts_with: "A" } }

// Logical
{ _and: [
  { status: { _eq: "published" } },
  { age: { _gt: 18 } }
] }

// Relations
{ author: { name: { _eq: "John" } } }
```
