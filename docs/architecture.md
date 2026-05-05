# Exodus Architecture

## Vision

Edem is a framework for **declarative applications**. Instead of writing code, developers describe what an application should do through manifests: schema, flows, and UI. A universal runtime interprets these manifests.

Exodus is an IDE for building Edem applications. Exodus itself is an Edem application — self-referential by design.

```
build(exodus) = exodus
```

## Core Principle

```
Traditional development:
  Code → Compilation → Application

Edem development:
  Manifests (schema + flows + UI) → Runtime → Application
```

The developer **declares**, never codes:
- **Schema** — what data exists, what fields, what relations
- **Flows** — what happens when (triggers → actions)
- **UI** — how it looks, what binds to what

The runtime **interprets** manifests. The same runtime for all applications.

## Artifact

```
Artifact = Schema manifest + Flows manifest + UI manifest + Runtime + Environment
```

| Component | Format | Description |
|-----------|--------|-------------|
| Schema | Declarative JSON | Collections, fields, relations, validations |
| Flows | Declarative JSON | Graph of nodes, triggers, connections |
| UI | Declarative JSON | Pages, components, bindings to data/flows |
| Runtime | JS bundle | edem-core + edem modules — same for all apps |
| Environment | Platform wrapper | Electrobun (desktop), browser (web), CLI |

## Three Base Modules

Everything in an Edem application is built on three meta-modules:

| Module | Role | Status |
|--------|------|--------|
| **edem-data** | Schema + data storage (meta-level) | Working |
| **edem-flows** | Business logic engine | Working |
| **edem-ui** | Rendering engine | Stub |

All application features (logger, settings, app-state, etc.) are NOT separate modules. They are **collections + flows + UI** defined through the three base modules.

```
Logger:
  data:   collection "logs" { level, message, timestamp, source }
  flow:   on "log:entry" → insert item in "logs"
  ui:     page "/debug/logs" → list component bound to "logs"

Settings:
  data:   collection "settings" { key, value, type }
  flow:   on "setting:changed" → update item in "settings"
  ui:     page "/settings" → form component bound to "settings"
```

## Edem Packages

| Package | Role | Status |
|---------|------|--------|
| edem-core | Module system, RPC, worker abstraction | Working |
| edem-data | Collections, items, fields — the meta-level | Working |
| edem-flows | Triggers, nodes, actions, DAG engine | Working |
| edem-ui | Pages, components, rendering | Stub (in-memory) |
| edem-mcp | MCP tools integration | Stub |
| edem-runners | Distributed task execution | Stub |
| edem-electrobun | Bun ↔ Webview bridge | Working |

## edem-data as Meta-Level

edem-data is the foundation. It is self-describing — it stores its own schema using its own tables.

### Bootstrap tables (hardcoded in edem-data)

These tables exist at the meta-level. They are not collections — they define what collections ARE.

| Table | Purpose |
|-------|---------|
| projects | Container for collections (grouping, build target) |
| collections | Meta-schema: what collections exist |
| fields | Meta-schema: what fields each collection has |
| items | Data storage: items in collections |

### System capabilities (in edem-data)

These are built-in mechanisms, not collections. They operate on items.

| Table | Purpose |
|-------|---------|
| relations | Links between items across collections |
| itemVersions | Version history for items |
| itemLocks | Pessimistic locking for concurrent editing |
| files | Content-addressed file storage |
| itemFiles | Junction between items and files |
| fileThumbnails | Thumbnail variants for files (small/medium/large) |
| fieldMigrations | Schema evolution tracking |
| templates | Predefined project/collection configurations |
| templateTags | Tags for template discovery |

### Projects

Projects are a core concept in edem-data. A project is a container for collections and serves as the unit of build.

- Every collection belongs to a project
- Flows and UI are collections within a project
- Build reads a project and produces an artifact
- Projects have a `type` that determines the environment (desktop/web/cli)

## Development vs Runtime

edem-data operates in two modes:

### Development mode (inside Exodus)

Like Directus — dynamic schema, full CRUD on meta-level:

- Create/modify/delete collections and fields
- Add/remove items in any collection
- Schema changes are instant (no ALTER TABLE)
- All manifests stored in SQLite as data
- Data editor, Flow editor, UI editor are CRUD interfaces

### Runtime mode (built application)

Schema is fixed, only data operations:

- Schema loaded from manifest — cannot be changed
- Only CRUD on items within existing collections
- Validates data against fixed schema
- No dynamic collection creation
- SQLite for user data only

```
DEVELOPMENT                          RUNTIME
┌─────────────────────┐              ┌─────────────────────┐
│ Dynamic schema       │    BUILD    │ Fixed schema         │
│ Full CRUD            │ ──────────→ │ Data CRUD only       │
│ Manifests in SQLite  │             │ Manifests in JSON    │
│ edem-data = engine   │             │ edem-data = validator│
└─────────────────────┘              └─────────────────────┘
```

## Lifecycle

### 1. Development (inside Exodus)

All manifests live in SQLite as data:

```
SQLite (edem-data)
├── projects
│   └── "Task Manager" (type: desktop)
│
├── collections (schema manifest)
│   ├── tasks { title: string, status: string, ... }
│   └── users { name: string, email: string, ... }
│
├── items (flows manifest)
│   └── collection "flows"
│       ├── flow_1 { trigger: item.created, nodes: [...] }
│       └── flow_2 { trigger: schedule, nodes: [...] }
│
└── items (UI manifest)
    └── collection "pages"
        ├── "/" { components: [list, nav, ...] }
        └── "/task/:id" { components: [detail, form, ...] }
```

### 2. Build

Read manifests from SQLite, package into artifact:

```
input:  SQLite (project_id)
output: dist/
        ├── schema.json    ← collections + fields + relations
        ├── flows.json     ← flow graphs
        ├── ui.json        ← pages + components
        ├── runtime.js     ← edem bundle
        └── app            ← environment wrapper
```

### 3. Runtime (on user's machine)

```
Runtime
├── schema.json → loaded once, defines valid collections/fields
├── flows.json → loaded once, registers triggers/actions
├── ui.json → loaded once, renders pages
└── data.db → SQLite for user data (items, relations, files)
```

## Self-Referential Architecture

Exodus stores its own schema as a project in its own SQLite:

```
Exodus SQLite
├── project "exodus" (type: desktop)
│
├── collections
│   ├── projects { name, slug, description, icon, color, type, sort_order }
│   ├── ideas { project_id, title, description, level, type, status }
│   ├── logs { level, message, source, args, count }
│   ├── app_state (singleton) { last_route, locale, theme, window_frame, window_maximized }
│   └── updater_status (singleton) { status, current_version, latest_version, error }
│
└── items
    ├── projects: [{ name: "My Project", ... }, ...]
    ├── logs: [...]
    └── ...
```

When Exodus builds itself:
1. Reads its own project from SQLite
2. Extracts schema, flows, UI manifests
3. Packages with edem runtime + Electrobun
4. Result = same Exodus application

## Current State

Exodus is fully on edem:

| Module | System | Storage |
|--------|--------|---------|
| projects | Edem | edem-data (SQLite) |
| logger | Edem | edem-data (SQLite) |
| app-state | Edem | edem-data (SQLite) |
| updater | Edem | edem-data (SQLite) |
| settings | Edem | via app-state |
| debug | Vue pages only | reads logs + app_state |

All modules use edem-data for storage. Evento has been removed.

## Migration Plan

~~Incremental migration. Mix old and new, gradually transform Exodus into a full Edem application.~~

**Completed.** All modules migrated to edem. Evento removed.

### Phase 1: edem-flows → data backend

- edem-flows reads/writes flows as items in collection "flows"
- Remove in-memory Map from edem-flows
- edem-flows depends on edem-data

**Status: Implemented.** edem-flows stores flows/runs in edem-data collections. 12 node types, DAG engine, retry/timeout support.

### Phase 2: edem-ui → data backend

- edem-ui reads/writes pages as items in collection "pages"
- Remove in-memory Map from edem-ui
- edem-ui depends on edem-data

**Status: Not started.** edem-ui still uses in-memory Map.

### Phase 3: Exodus modules → edem collections

~~Migrate modules one by one. Parallel operation (evento + edem), then switch off evento.~~

**Completed.** All modules migrated:
1. ~~`app-state` → collection `app_state`~~ ✅
2. ~~`logger` → collection `logs`~~ ✅
3. ~~`settings` → collection `settings`~~ ✅
4. ~~`updater` → config in edem, API stays Electrobun~~ ✅

### Phase 4: Exodus bootstrap

Expand `init.ts` to create full Exodus project structure:
- project "exodus" (type: desktop)
- system collections: logs, settings, app_state, flows, pages
- system flows: logging, state persistence
- system pages: settings, debug, logger

### Phase 5: Notes app

Second project. Build in Exodus using data/flows/ui editors.
- project "Notes" (type: desktop)
- collections: notes, folders, tags
- flows: auto-slug, trash
- UI: list, editor, sidebar

### Phase 6: Build pipeline

Exodus can build projects into standalone apps.
- Read project from edem-data
- Export schema/flows/ui manifests as JSON
- Package with edem runtime + environment
- → standalone Electrobun app

## Open Questions

1. **Runtime data storage**: JSON blobs with schema validation? Or real SQL columns from manifest?

2. **edem-data modes**: Should edem-data explicitly split into `mode: "development"` (dynamic) and `mode: "runtime"` (static)?

3. **Bootstrap tables**: Current 11 tables — which stay as bootstrap, which become collections?

4. **edem-data size**: 1529 lines, 52+ procedures. Should it be split into sub-modules (edem-relations, edem-versions, edem-locks, edem-files)?

5. **UI rendering**: Vue at runtime? Custom renderer from JSON manifest?

6. **Flow execution**: Interpreter for node graph? Or compile to JS?

7. **Data migration**: Schema changes between builds — how to migrate existing user databases?

8. **Exodus protection**: Should certain collections be protected from user modification?
