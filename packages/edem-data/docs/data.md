# Data Layer — Vision

## Overview

The foundation of the Edem system. Stores all user data: projects, collections, items, relations, files, templates.

Built as an `edem-core` module — typed mutations, queries, and subscriptions.

Reference: **Directus**

## Concepts

### Project

Top-level container for grouping collections.

```typescript
type Project = {
  id: string
  slug: string
  name: string
  description?: string
  icon?: string
  color?: string
  is_default: boolean
  sort_order: number
  created_at: number
  updated_at: number
  deleted_at?: number
}
```

### Collection

A table in the database. Belongs to a project. User creates collections through a constructor.

```typescript
type Collection = {
  id: string
  project_id: string
  parent_id?: string          // hierarchical nesting
  template_id?: string        // source template
  name: string
  slug: string
  description?: string
  icon?: string
  singleton: boolean          // allows only one item
  system: boolean             // system-managed
  schema_version: number      // incremented on field changes
  default_sort_field?: string
  default_sort_dir?: 'asc' | 'desc'
  fields: Field[]
  meta?: Record<string, unknown>
  created_at: number
  updated_at: number
  deleted_at?: number
}
```

### Field

A column in a collection. Has a type that defines behavior.

```typescript
type Field = {
  id: string
  collection_id: string
  name: string
  labels?: Record<string, string>  // i18n { "en": "Title", "ru": "Заголовок" }
  type: FieldType
  interface?: InterfaceType        // how to render in UI
  interface_options?: Record<string, unknown>
  display?: DisplayType            // how to display in lists
  display_options?: Record<string, unknown>
  group_name?: string
  required: boolean
  hidden: boolean
  readonly: boolean
  system: boolean
  indexed: boolean
  special?: SpecialType            // auto-populated
  computed: boolean
  computed_deps?: string[]         // field names this depends on
  default_value?: unknown
  validation?: FieldValidation     // validation rules
  meta?: Record<string, unknown>
}
```

### Item

A row in a collection. Stores actual data as JSON.

```typescript
type Item = {
  id: string
  collection_id: string
  schema_version: number      // matches collection.schema_version at write time
  source?: string             // origin: "manual", "import", "flows:xxx"
  data: Record<string, unknown>
  created_at: number
  updated_at: number
  deleted_at?: number
}
```

### Relation

Links between items across collections. Supports ordered many-to-many and one-to-many.

```typescript
type Relation = {
  id: string
  source_item_id: string
  source_field_id: string       // the relation field
  target_item_id: string
  target_collection_id: string
  sort_order: number
  created_at: number
}
```

### ItemVersion

Snapshot of item data before each update. Enables history and restore.

```typescript
type ItemVersion = {
  id: string
  item_id: string
  version: number
  data: Record<string, unknown>
  source?: string
  created_at: number
}
```

### ItemLock

Optimistic lock to prevent concurrent edits.

```typescript
type ItemLock = {
  id: string
  item_id: string
  locked_by: string
  reason?: string
  expires_at: number
  created_at: number
}
```

### File

Content-addressable file storage. The hash is the primary key.

```typescript
type File = {
  hash: string                  // SHA256, primary key
  original_name: string
  mime_type: string
  size: number
  storage_path: string
  ref_count: number             // how many items reference this file
  // Media metadata (extracted via ffprobe)
  width?: number
  height?: number
  duration?: number
  frame_rate?: number
  video_codec?: string
  audio_codec?: string
  bitrate?: number
  sample_rate?: number
  channels?: number
  orientation?: number
  color_space?: string
  metadata?: Record<string, unknown>
  created_at: number
}
```

### ItemFile

Attachment of a file to an item field.

```typescript
type ItemFile = {
  id: string
  item_id: string
  field_id?: string
  file_hash: string
  sort_order: number
  metadata?: Record<string, unknown>
  created_at: number
}
```

### FieldMigration

Schema evolution operation. Applied lazily when items are read.

```typescript
type FieldMigration = {
  id: string
  collection_id: string
  schema_version: number
  operation: 'add' | 'delete' | 'rename' | 'change_type'
  field_name: string
  old_field_name?: string
  old_field_type?: string
  new_field_type?: string
  default_value?: unknown
  created_at: number
}
```

### Template

Reusable project or collection template.

```typescript
type TemplateSource = 'builtin' | 'user' | 'community'

type ProjectTemplate = {
  id: string
  source: TemplateSource
  slug: string
  name: string
  description?: string
  icon?: string
  color?: string
  preview?: string
  version: number
  author?: string
  config: Record<string, unknown>
  collections: CollectionTemplateConfig[]
}

type CollectionTemplate = {
  id: string
  source: TemplateSource
  slug: string
  name: string
  description?: string
  icon?: string
  version: number
  config: Record<string, unknown>
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
| `relation` | TEXT (id) | Link to another item |
| `collection` | — | Virtual, defines child collection |

### Special Types

| Type | Storage | Description |
|------|---------|-------------|
| `uuid` | TEXT | Auto-generated UUID |
| `timestamp` | INTEGER | Auto-generated timestamp |
| `user` | TEXT | Current user (for multi-user future) |
| `sort` | INTEGER | Manual sort order |

### Interface Types

How a field is rendered in the UI input.

| Interface | Applicable types | Description |
|-----------|-----------------|-------------|
| `input` | string, number | Single-line text input |
| `textarea` | text | Multi-line text area |
| `select` | string, number | Dropdown select |
| `rating` | number | Star/number rating |
| `toggle` | boolean | On/off toggle |
| `datetime` | date, datetime | Date/time picker |
| `image` | image | Image picker with preview |
| `file` | file | File picker |
| `relation` | relation | Relation picker |

### Display Types

How a field value is displayed in lists and cards.

| Display | Description |
|---------|-------------|
| `raw` | Plain text |
| `badge` | Colored badge/tag |
| `datetime` | Formatted date/time |
| `image` | Thumbnail preview |
| `link` | Clickable link |

### Special Behaviors

| Special | Description |
|---------|-------------|
| `uuid` | Auto-generated on create, immutable |
| `date-created` | Set on create, readonly |
| `date-updated` | Set on every update, readonly |

### Field Validation

```typescript
type FieldValidation = {
  required?: boolean
  unique?: boolean
  pattern?: string            // regex
  min_value?: number
  max_value?: number
  min_length?: number
  max_length?: number
}
```

## API Surface

### Projects

```typescript
// Mutations
edem.data.createProject({ name, slug?, description?, icon?, color? }): { id }
edem.data.updateProject({ project_id, name?, slug?, description?, icon?, color?, sort_order? }): { id }
edem.data.deleteProject({ project_id }): { success }
edem.data.restoreProject({ project_id }): { success }
edem.data.setDefaultProject({ project_id }): { success }

// Queries
edem.data.getProject({ project_id }): { project }
edem.data.listProjects(): { projects }
edem.data.getDefaultProject(): { project }
```

### Collections

```typescript
// Mutations
edem.data.createCollection({ project_id, name, slug, parent_id?, description?, icon?, singleton?, fields?, meta? }): { id }
edem.data.updateCollection({ collection_id, name?, slug?, description?, icon?, singleton?, fields?, default_sort_field?, default_sort_dir?, meta? }): { id }
edem.data.deleteCollection({ collection_id }): { success }
edem.data.restoreCollection({ collection_id }): { success }
edem.data.emptyCollectionTrash(): { deleted: number }

// Queries
edem.data.getCollection({ collection_id }): { collection }
edem.data.listCollections({ project_id?, parent_id? }): { collections }
edem.data.getDeletedCollections({ project_id? }): { collections }
```

### Fields

```typescript
// Mutations
edem.data.createField({ collection_id, name, type, interface?, display?, required?, hidden?, readonly?, special?, default_value?, validation?, meta? }): { id }
edem.data.updateField({ field_id, name?, type?, interface?, display?, required?, hidden?, readonly?, default_value?, validation?, meta? }): { id }
edem.data.deleteField({ field_id }): { success }
edem.data.reorderFields({ field_ids: string[] }): { success }

// Queries
edem.data.getFields({ collection_id }): { fields }
edem.data.getField({ field_id }): { field }
```

### Items

```typescript
// Mutations
edem.data.createItem({ collection_id, data, source? }): { id }
edem.data.updateItem({ item_id, data, source?, create_version? }): { id }
edem.data.deleteItem({ item_id }): { success }
edem.data.restoreItem({ item_id }): { success }
edem.data.deleteItems({ item_ids: string[] }): { deleted: number }
edem.data.updateItems({ item_ids: string[], data, source? }): { updated: number }
edem.data.updateItemsBatch({ updates: { item_id, data }[], source? }): { updated: number }
edem.data.deleteItemsByFilter({ collection_id, filter }): { deleted: number }
edem.data.emptyItemsTrash({ collection_id }): { deleted: number }

// Queries
edem.data.getItem({ item_id }): { item }
edem.data.queryItems({ collection_id, filter?, sort?, limit?, offset? }): { items, total }
edem.data.countItems({ collection_id, filter? }): { count }
edem.data.getDeletedItems({ collection_id }): { items }
```

### Relations

```typescript
// Mutations
edem.data.addRelation({ source_item_id, source_field_id, target_item_id, target_collection_id }): { relation }
edem.data.removeRelation({ relation_id }): { success }
edem.data.reorderRelations({ relation_ids: string[] }): { success }

// Queries
edem.data.getItemRelations({ item_id, field_id }): { relations }
edem.data.getAllItemRelations({ item_id }): { relations }
edem.data.getReverseRelations({ item_id }): { relations }
```

### Versions

```typescript
// Mutations
edem.data.restoreItemVersion({ version_id }): { success }

// Queries
edem.data.getItemVersions({ item_id }): { versions }
edem.data.getItemVersion({ version_id }): { version }
edem.data.countVersions({ item_id }): { count }
```

### Locks

```typescript
// Mutations
edem.data.lockItem({ item_id, locked_by, reason?, ttl_seconds? }): { lock }
edem.data.unlockItem({ item_id }): { success }
edem.data.forceUnlockItem({ item_id }): { success }
edem.data.extendLock({ item_id, ttl_seconds? }): { success }

// Queries
edem.data.getItemLock({ item_id }): { lock }
edem.data.isItemLocked({ item_id }): { locked: boolean }
```

### Files

```typescript
// Mutations
edem.data.storeFile({ file_path, name? }): { hash, size, path }
edem.data.deleteFile({ hash }): { success }
edem.data.attachFile({ item_id, file_hash, field_id?, metadata? }): { id }
edem.data.detachFile({ item_file_id }): { success }
edem.data.updateItemFile({ item_file_id, metadata? }): { success }
edem.data.reorderItemFiles({ item_file_ids: string[] }): { success }

// Queries
edem.data.getFile({ hash }): { file }
edem.data.fileExists({ hash }): { exists }
edem.data.getFilePath({ hash }): { path }
edem.data.getFileStreamUrl({ hash }): { url }
edem.data.getItemFiles({ item_id }): { files }
edem.data.getItemFieldFiles({ item_id, field_id }): { files }
```

### Thumbnails

```typescript
// Mutations
edem.data.generateThumbnails({ file_hash, sizes? }): { thumbnails }

// Queries
edem.data.getThumbnail({ file_hash, size }): { thumbnail }
edem.data.getFileThumbnails({ file_hash }): { thumbnails }
edem.data.getThumbnailPath({ file_hash, size }): { path }
```

### Search

```typescript
// Mutations
edem.data.reindexFts(): { success }
edem.data.reindexCollectionFts({ collection_id }): { success }

// Queries
edem.data.searchItems({ collection_id, query, limit?, offset? }): { items, total }
edem.data.countSearchResults({ collection_id, query }): { count }
```

### Templates

```typescript
// Mutations
edem.data.createProjectTemplate({ project_id, name, description?, icon?, tags? }): { id }
edem.data.createCollectionTemplate({ collection_id, name, description?, icon?, tags? }): { id }
edem.data.deleteProjectTemplate({ template_id }): { success }
edem.data.deleteCollectionTemplate({ template_id }): { success }
edem.data.installProjectTemplate({ template_id }): { project_id }
edem.data.installCollectionTemplate({ template_id, project_id }): { collection_id }
edem.data.exportProjectAsTemplate({ project_id }): { template }
edem.data.exportCollectionAsTemplate({ collection_id }): { template }

// Queries
edem.data.getProjectTemplates(): { templates }
edem.data.getProjectTemplate({ template_id }): { template }
edem.data.getCollectionTemplates(): { templates }
edem.data.getCollectionTemplate({ template_id }): { template }
edem.data.getTemplateTags(): { tags }
edem.data.searchTemplatesByTag({ tag }): { templates }
```

### Migrations

```typescript
// Mutations
edem.data.migrateItemsBatch({ collection_id, batch_size? }): { migrated }

// Queries
edem.data.getMigrationStatus({ collection_id }): { status }
edem.data.countItemsNeedingMigration({ collection_id }): { count }
edem.data.getMigrationsFromVersion({ collection_id, from_version }): { migrations }
```

## Query Language

Filter syntax inspired by Directus.

### Comparison Operators

```typescript
{ status: { _eq: "published" } }
{ age: { _neq: 25 } }
{ price: { _gt: 100 } }
{ rating: { _gte: 4 } }
{ stock: { _lt: 10 } }
{ score: { _lte: 50 } }
```

### String Operators

```typescript
{ title: { _contains: "hello" } }
{ name: { _starts_with: "A" } }
{ email: { _ends_with: "@gmail.com" } }
```

### Set Operators

```typescript
{ status: { _in: ["draft", "review"] } }
{ price: { _between: [10, 100] } }
```

### Logical Operators

```typescript
{ _and: [
  { status: { _eq: "published" } },
  { age: { _gt: 18 } }
] }

{ _or: [
  { status: { _eq: "draft" } },
  { status: { _eq: "review" } }
] }
```

### Relation Filtering

```typescript
// Filter items by related item data
{ author: { name: { _eq: "John" } } }
{ tags: { label: { _contains: "important" } } }
```

### Sorting

Prefix `-` for descending order.

```typescript
sort: ["-created_at", "name"]
// → ORDER BY created_at DESC, name ASC
```

### Pagination

```typescript
{ limit: 20, offset: 40 }
```

## Events

### Command → Result Pattern

Each mutation emits a result event after success.

```
data:create_project      → data:project_created
data:update_project      → data:project_updated
data:delete_project      → data:project_deleted

data:create_collection   → data:collection_created
data:update_collection   → data:collection_updated
data:delete_collection   → data:collection_deleted

data:create_item         → data:item_created
data:update_item         → data:item_updated
data:delete_item         → data:item_deleted

data:add_relation        → data:relation_added
data:remove_relation     → data:relation_removed

data:lock_item           → data:item_locked
data:unlock_item         → data:item_unlocked

data:restore_version     → data:version_restored
```

### Event Source

Every event carries an `EventSource` for tracing the origin of changes.

```typescript
type EventSource = {
  id: string              // "manual", "import", "flows:xxx", "data"
  metadata?: Record<string, unknown>
}
```

### Event Schemas

```typescript
// data:create_item
{
  collection_id: string,
  data: Record<string, unknown>,
  source: EventSource,
  depth: number,
  trace_id: string,
  timestamp: number
}

// data:item_created
{
  item_id: string,
  collection_id: string,
  data: Record<string, unknown>,
  source: EventSource,
  depth: number,
  trace_id: string,
  timestamp: number
}

// data:relation_added
{
  relation_id: string,
  source_item_id: string,
  target_item_id: string,
  source: EventSource,
  depth: number,
  trace_id: string,
  timestamp: number
}
```

## Dynamic Schema

Collections and fields are stored in the database itself (meta-tables).

```sql
-- Projects
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT,
  is_default INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);

-- Collections
CREATE TABLE collections (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  parent_id TEXT,
  template_id TEXT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  singleton INTEGER DEFAULT 0,
  system INTEGER DEFAULT 0,
  schema_version INTEGER DEFAULT 1,
  default_sort_field TEXT,
  default_sort_dir TEXT DEFAULT 'asc',
  meta TEXT, -- JSON
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Fields
CREATE TABLE fields (
  id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL,
  name TEXT NOT NULL,
  labels TEXT, -- JSON i18n
  type TEXT NOT NULL,
  interface TEXT,
  interface_options TEXT, -- JSON
  display TEXT,
  display_options TEXT, -- JSON
  group_name TEXT,
  required INTEGER DEFAULT 0,
  hidden INTEGER DEFAULT 0,
  readonly INTEGER DEFAULT 0,
  system INTEGER DEFAULT 0,
  indexed INTEGER DEFAULT 0,
  special TEXT,
  computed INTEGER DEFAULT 0,
  computed_deps TEXT, -- JSON array
  default_value TEXT,
  validation TEXT, -- JSON
  meta TEXT, -- JSON
  FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
);

-- Items (generic, data as JSON)
CREATE TABLE items (
  id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL,
  schema_version INTEGER DEFAULT 1,
  source TEXT,
  data TEXT NOT NULL, -- JSON
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
);

-- Relations (M2M, O2M)
CREATE TABLE relations (
  id TEXT PRIMARY KEY,
  source_item_id TEXT NOT NULL,
  source_field_id TEXT NOT NULL,
  target_item_id TEXT NOT NULL,
  target_collection_id TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (source_item_id) REFERENCES items(id) ON DELETE CASCADE,
  FOREIGN KEY (source_field_id) REFERENCES fields(id) ON DELETE CASCADE,
  FOREIGN KEY (target_item_id) REFERENCES items(id) ON DELETE CASCADE,
  FOREIGN KEY (target_collection_id) REFERENCES collections(id) ON DELETE CASCADE
);

CREATE INDEX idx_relations_source ON relations(source_item_id, source_field_id);
CREATE INDEX idx_relations_target ON relations(target_item_id);

-- Item versions
CREATE TABLE item_versions (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  data TEXT NOT NULL, -- JSON
  source TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
);

CREATE INDEX idx_item_versions_item ON item_versions(item_id);

-- Item locks
CREATE TABLE item_locks (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL UNIQUE,
  locked_by TEXT NOT NULL,
  reason TEXT,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
);

-- Files (content-addressable)
CREATE TABLE files (
  hash TEXT PRIMARY KEY,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  ref_count INTEGER DEFAULT 1,
  width INTEGER,
  height INTEGER,
  duration REAL,
  frame_rate REAL,
  video_codec TEXT,
  audio_codec TEXT,
  bitrate INTEGER,
  sample_rate INTEGER,
  channels INTEGER,
  orientation INTEGER,
  color_space TEXT,
  metadata TEXT, -- JSON
  created_at INTEGER NOT NULL
);

-- Item files (attachment junction)
CREATE TABLE item_files (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  field_id TEXT,
  file_hash TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  metadata TEXT, -- JSON
  created_at INTEGER NOT NULL,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  FOREIGN KEY (file_hash) REFERENCES files(hash) ON DELETE CASCADE
);

CREATE INDEX idx_item_files_item ON item_files(item_id);

-- File thumbnails
CREATE TABLE file_thumbnails (
  id TEXT PRIMARY KEY,
  file_hash TEXT NOT NULL,
  size_name TEXT NOT NULL, -- 'small' | 'medium' | 'large'
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  format TEXT DEFAULT 'webp',
  storage_path TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (file_hash) REFERENCES files(hash) ON DELETE CASCADE
);

CREATE INDEX idx_file_thumbnails_hash ON file_thumbnails(file_hash);

-- Field migrations
CREATE TABLE field_migrations (
  id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  operation TEXT NOT NULL, -- 'add' | 'delete' | 'rename' | 'change_type'
  field_name TEXT NOT NULL,
  old_field_name TEXT,
  old_field_type TEXT,
  new_field_type TEXT,
  default_value TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
);

-- Templates
CREATE TABLE templates (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL, -- 'project' | 'collection'
  source TEXT NOT NULL, -- 'builtin' | 'user' | 'community'
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT,
  preview TEXT,
  version INTEGER DEFAULT 1,
  author TEXT,
  config TEXT NOT NULL, -- JSON
  created_at INTEGER NOT NULL
);

CREATE TABLE template_tags (
  id TEXT PRIMARY KEY,
  template_type TEXT NOT NULL,
  template_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE
);

CREATE INDEX idx_template_tags_tag ON template_tags(tag);

-- FTS5 for full-text search
CREATE VIRTUAL TABLE items_fts USING fts5(
  collection_id,
  data,
  content=items,
  content_rowid=rowid
);
```

When a collection is created:
1. Insert into `collections` table
2. Insert field definitions into `fields` table
3. Items stored in generic `items` table with JSON data
4. Relations tracked in `relations` table

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

thumbnails/
├── ab_small.webp
├── ab_medium.webp
└── ab_large.webp
```

**Benefits:**
- Deduplication — same file stored once
- Immutable — hash never changes
- Cache-friendly — hash as cache key
- ref_count — automatic orphan cleanup

### Thumbnails

Three standard sizes, stored as WebP:

| Size | Dimensions | Use case |
|------|-----------|----------|
| `small` | 150×150 | List thumbnails |
| `medium` | 400×400 | Card previews |
| `large` | 800×800 | Detail view |

For videos: extracts a frame at 10% of duration via ffmpeg.

### Media Metadata

Automatically extracted from video/audio files via ffprobe:
- Dimensions (width, height)
- Duration, frame rate
- Codecs (video, audio)
- Bitrate, sample rate, channels
- Orientation, color space

## Lazy Migration

When collection schema changes (fields added/removed/renamed), items are **not migrated immediately**. Instead:

1. `collection.schema_version` is incremented on field changes
2. When an item is fetched, its `schema_version` is compared to the collection's
3. If `item.schema_version < collection.schema_version`, pending migrations are applied on-read
4. The item is returned with migrated data (write-back is optional)

For large collections, batch migration is available:

```typescript
// Check how many items need migration
const { count } = await edem.data.countItemsNeedingMigration({ collection_id })

// Migrate in batches
await edem.data.migrateItemsBatch({ collection_id, batch_size: 100 })
```

## Optimistic Locking

Prevents concurrent edits with TTL-based locks.

```typescript
// Lock an item (default TTL: 5 minutes)
const { lock } = await edem.data.lockItem({
  item_id: "abc",
  locked_by: "user-1",
  reason: "Editing title"
})

// Check if locked
const { locked } = await edem.data.isItemLocked({ item_id: "abc" })

// Unlock when done
await edem.data.unlockItem({ item_id: "abc" })

// Force unlock (admin override)
await edem.data.forceUnlockItem({ item_id: "abc" })

// Extend TTL
await edem.data.extendLock({ item_id: "abc", ttl_seconds: 600 })
```

**Behavior:**
- Expired locks are auto-cleaned on access
- `updateItem` checks lock before applying changes
- Only the lock holder can unlock (unless force)

## Version History

Automatic snapshots on every item update.

```typescript
// Update creates a version snapshot automatically
await edem.data.updateItem({
  item_id: "abc",
  data: { title: "New title" },
  create_version: true  // default: true
})

// List versions
const { versions } = await edem.data.getItemVersions({ item_id: "abc" })

// Restore to a specific version
await edem.data.restoreItemVersion({ version_id: "v3" })
```

**Retention:**
- Max 50 versions per item
- Versions older than 90 days are cleaned up (keeping last 5)
- Cleanup runs on item access

## Templates

### Built-in Templates

Shipped with the app, created on first run.

**Project templates:**
- `media-tracker` — tracks games, movies, books with cover images

**Collection templates:**
- `games` — title, platform, rating, status, cover
- `tasks` — title, description, status, priority, due_date
- `notes` — title, body, tags

### User Templates

Users can export their own projects/collections as templates.

```typescript
// Export
const { template } = await edem.data.exportCollectionAsTemplate({
  collection_id: "my-collection"
})

// Install
const { collection_id } = await edem.data.installCollectionTemplate({
  template_id: "games",
  project_id: "my-project"
})
```

### Template Tags

Templates can be tagged for discovery.

```typescript
const { tags } = await edem.data.getTemplateTags()
const { templates } = await edem.data.searchTemplatesByTag({ tag: "productivity" })
```
