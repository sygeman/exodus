# Database Design

## Overview

SQLite for all modules. Each module has its own database file.

## Separate DBs per Module

### Decision

Each module has its own SQLite database.

### Trade-offs

| Aspect | Single DB | Separate DBs (chosen) |
|--------|-----------|----------------------|
| Cross-module transactions | ✓ Possible | ✗ Impossible |
| Module isolation | Hard | ✓ Complete |
| Add/remove module | Migrations | ✓ Add/remove file |
| Reset one module | Hard | ✓ Delete file |
| Parallel access | SQLite locks whole DB | ✓ Each module — own lock |
| Independent migrations | Shared version | ✓ Each module manages own |

### Why Eventual Consistency is Acceptable

For **local-first single-user** application:

- Idempotency keys allow retry without duplication
- Source tracking in events allows state recovery
- Crash recovery mechanism restores interrupted operations
- Critical data (data.db) is not lost, only execution metadata

## DB Files

```
{appData}/
├── data.db           # Projects, collections, items, files
├── ui.db             # UI configuration
├── flows.db          # Workflows
├── tasks.db          # Task queue
├── runners.db        # Runners
├── settings.db       # Settings
├── notifications.db  # Notifications
├── metrics.db        # Metrics
├── events.db         # Event log
└── files/            # Content-addressable storage
    ├── ab/cd/...     # SHA256 hash-based paths
    └── ...
```

## Schema Design

### Module Schema Pattern

```typescript
// db/schema.ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"

export const items = sqliteTable("items", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  created_at: integer("created_at", { mode: "number" }).notNull(),
})

export type ItemRow = typeof items.$inferSelect
export type NewItemRow = typeof items.$inferInsert
```

### Migrations

SQL-based migrations in module folder:

```typescript
// db/index.ts
import { Database } from "bun:sqlite"
import { drizzle } from "drizzle-orm/bun-sqlite"

const DB_PATH = getDbPath() // Module-specific path

const sqlite = new Database(DB_PATH)
sqlite.exec("PRAGMA journal_mode = WAL;")

export const db = drizzle(sqlite, { schema: { items } })

export function migrate() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_items_created_at ON items(created_at);
  `)
}
```

## SQLite Configuration

### WAL Mode

```sql
PRAGMA journal_mode = WAL;
```

Benefits:
- Better concurrency (readers don't block writers)
- Faster writes
- Crash recovery

### Recommended PRAGMAs

```sql
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -64000;  -- 64MB cache
PRAGMA temp_store = MEMORY;
```

## Data Layer Schema

### Collections

```sql
CREATE TABLE collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  meta TEXT  -- JSON
);
```

### Fields

```sql
CREATE TABLE fields (
  id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  options TEXT,  -- JSON
  required INTEGER DEFAULT 0,
  default_value TEXT,
  meta TEXT  -- JSON
);
```

### Items

```sql
CREATE TABLE items (
  id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL,
  data TEXT NOT NULL,  -- JSON
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_items_collection ON items(collection_id);
CREATE INDEX idx_items_created_at ON items(created_at);
```

## ATTACH DATABASE

Join databases when needed:

```sql
-- Attach settings DB to query settings from data context
ATTACH DATABASE '{appData}/settings.db' AS settings;

-- Query across databases
SELECT i.*, s.value as setting_value
FROM items i
LEFT JOIN settings.settings s ON s.key = 'some_key';

-- Detach when done
DETACH DATABASE settings;
```

## Backup/Restore

### Simple Backup

SQLite file = backup. Copy it.

```bash
# Backup
cp {appData}/*.db {appData}/backup/

# Restore
cp {appData}/backup/*.db {appData}/
```

### Export/Import (Future)

JSON format for transferring between devices.

```typescript
// Export
function exportModule(moduleName: string): object {
  const db = getDb(moduleName)
  return {
    version: 1,
    tables: {
      items: db.select().from(items).all()
    }
  }
}

// Import
function importModule(moduleName: string, data: object) {
  const db = getDb(moduleName)
  // Validate, then insert
}
```

## Performance

### Indexes

Create indexes for common queries:

```sql
-- Query by collection
CREATE INDEX idx_items_collection ON items(collection_id);

-- Sort by date
CREATE INDEX idx_items_created_at ON items(created_at);

-- Search by status
CREATE INDEX idx_items_status ON items(status);
```

### JSON Queries

Use `json_extract` for JSON fields:

```sql
-- Query items where data.title = "Elden Ring"
SELECT * FROM items
WHERE collection_id = 'games'
  AND json_extract(data, '$.title') = 'Elden Ring';

-- Index on JSON field (SQLite 3.38+)
CREATE INDEX idx_items_title ON items(
  json_extract(data, '$.title')
);
```

### Pagination

```sql
-- Offset-based
SELECT * FROM items
WHERE collection_id = 'games'
ORDER BY created_at DESC
LIMIT 20 OFFSET 40;

-- Cursor-based (better for large datasets)
SELECT * FROM items
WHERE collection_id = 'games'
  AND created_at < ?
ORDER BY created_at DESC
LIMIT 20;
```
