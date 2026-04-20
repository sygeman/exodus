# Edem Core

## Overview

Edem runtime core — module loader, database manager, tracing, and error utilities.

This package provides the foundational infrastructure for the Edem platform:
- **Event Bus** — type-safe, cross-environment event communication
- **Plugin System** — module lifecycle, registration, and boundaries
- **Database Manager** — SQLite per-module, WAL mode, ATTACH support

## Architecture

```
+------------------------------------------------------------------+
|                        Event Bus (Evento)                        |
+------------------------------------------------------------------+
    ^         ^         ^         ^         ^         ^         ^
    |         |         |         |         |         |         |
+---+---+ +---+---+ +---+---+ +---+---+ +---+---+ +---+---+ +---+---+
| data  | |  ui   | | flows | | tasks | |runners| |setting| |  mcp  |
+-------+ +-------+ +-------+ +-------+ +-------+ +-------+ +-------+
```

## Documentation

- [Event Bus](./docs/event-bus.md) — Event bus specification
- [Plugin System](./docs/plugin-system.md) — Plugin/module system
- [Database](./docs/database.md) — Database design

## Design Decisions

### Separate DBs for Modules

**Decision:** Each module has its own SQLite database.

**Why:** Complete isolation, easy add/remove, independent migrations, parallel access.

### Event-driven vs Direct Calls

**Decision:** Modules communicate only through events.

**Why:** Decoupling, extensibility, debugging, testability.

### SQLite vs Embedded KV

**Decision:** SQLite for all modules.

**Why:** SQL queries, JSON support, ATTACH DATABASE, tooling, familiarity.

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
│   ├── index.ts       # Export module messages
│   └── {locale}.ts    # Per-locale translations
├── pages/             # Vue pages (if UI module)
└── components/        # Vue components (optional)
```

## Core Modules

| Module | DB | Description |
|--------|-----|-------------|
| `data` | data.db | Projects, collections, items, files |
| `ui` | ui.db | Pages, components, bindings |
| `flows` | flows.db | Workflows, triggers |
| `tasks` | tasks.db | Task queue |
| `runners` | runners.db | Executors |
| `settings` | settings.db | Global settings |
| `notifications` | notifications.db | User notifications |
| `metrics` | metrics.db | Execution stats |
| `events` | events.db | Event log |
| `mcp` | — | MCP gateway |
