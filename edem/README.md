# Edem Architecture

## Overview

**Local-first, single-user** desktop application. No server, no accounts, no permissions.

**Key constraints:**

- **One process** — Electrobun main + webview, events cross-process via RPC
- **Local DBs** — all SQLite files in app data directory, ATTACH DATABASE available
- **MCP localhost** — stdio or HTTP transport, local clients only

Edem is built on a modular architecture of independent **modules** (plugins).
Modules communicate only through **events** (event-driven), without direct dependencies.

```
+------------------------------------------------------------------+
|                        Event Bus (Evento)                        |
+------------------------------------------------------------------+
    ^         ^         ^         ^         ^         ^         ^
    |         |         |         |         |         |         |
+---+---+ +---+---+ +---+---+ +---+---+ +---+---+ +---+---+ +---+---+
| data  | |  ui   | | flows | | tasks | |runners| |setting| |  mcp  |
+-------+ +-------+ +-------+ +-------+ +-------+ +-------+ +-------+
                                                                |
                                                        collects tools
                                                        from all modules
```

---

## Layers

| Layer | Purpose | Reference |
|-------|---------|-----------|
| **Data** | Foundation, data storage | Directus |
| **Flows** | Logic, reacts to data | Unreal Blueprints |
| **UI** | Presentation, displays data | v0.dev |
| **Runners** | Infrastructure, executes heavy tasks | GitLab Runners |
| **MCP** | End-to-end access for AI | — |

### Data
- Collection and field constructor
- Field types: basic, media, relations, special
- Dynamic schema — user defines structure

### UI
- Primitives: box, text, image, input
- Layouts: flex, grid, stack
- Data binding
- Generation via MCP + manual editing

### Flows
- Visual programming of behavior
- Events → conditions → actions
- All business logic in one place
- Not "automation", but application logic

### Runners
- Distributed task execution
- Simple registration: token + address
- Tags/capabilities: storage, conversion, download
- Tasks automatically distributed across runners

### MCP
- Full application control for AI agents
- Collection and data management
- UI generation and modification
- Flow creation
- Task execution

---

## Design Decisions

### Separate DBs for Modules

**Decision:** Each module has its own SQLite database.

**Alternative:** Single DB with all tables.

**Trade-offs:**

| Aspect | Single DB | Separate DBs (chosen) |
|--------|-----------|----------------------|
| Cross-module transactions | ✓ Possible | ✗ Impossible |
| Module isolation | Hard | ✓ Complete |
| Add/remove module | Migrations | ✓ Add/remove file |
| Reset one module | Hard | ✓ Delete file |
| Parallel access | SQLite locks whole DB | ✓ Each module — own lock |
| Independent migrations | Shared version | ✓ Each module manages own |

**Why eventual consistency is acceptable:**

For **local-first single-user** application:

- Idempotency keys allow retry without duplication
- Source tracking in events allows state recovery
- Crash recovery mechanism restores interrupted operations
- Critical data (data.db) is not lost, only execution metadata

### Event-driven vs Direct Calls

**Decision:** Modules communicate only through events.

**Alternative:** Direct calls between modules.

**Reasons:**

1. **Decoupling** — modules don't know about each other, only about events
2. **Extensibility** — new module can listen to existing events
3. **Debugging** — all events are logged in event_log
4. **Testability** — easy to mock events in tests

### SQLite vs Embedded KV

**Decision:** SQLite for all modules.

**Alternative:** RocksDB, LMDB, sled.

**Reasons:**

1. **SQL queries** — filtering, sorting, pagination out of the box
2. **JSON support** — `json_extract`, virtual columns
3. **ATTACH DATABASE** — can join DBs when needed
4. **Tooling** — CLI, GUI, debugging, backup = copy file
5. **Familiarity** — SQL is understood by most developers

---

## Module Structure

```
src/modules/{name}/
├── events.ts          # Event definitions (Zod schemas)
├── bun.ts             # Bun-side handlers (DB, business logic)
├── webview.ts         # Webview-side composables
├── db/
│   ├── schema.ts      # Drizzle schema
│   └── index.ts       # DB client, queries
├── i18n/
│   └── {locale}.ts    # Per-module translations
└── pages/             # Vue pages (if UI module)
```

See [core/plugin-system.md](./core/plugin-system.md) for full module specification.

---

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

---

## Documentation

**Architecture:**

- [layers/data.md](./layers/data.md) — Data layer
- [layers/ui.md](./layers/ui.md) — UI layer
- [layers/flows.md](./layers/flows.md) — Flows layer
- [layers/runners.md](./layers/runners.md) — Runners layer
- [layers/mcp.md](./layers/mcp.md) — MCP layer

**Core:**

- [core/event-bus.md](./core/event-bus.md) — Event bus specification
- [core/plugin-system.md](./core/plugin-system.md) — Plugin/module system
- [core/database.md](./core/database.md) — Database design
