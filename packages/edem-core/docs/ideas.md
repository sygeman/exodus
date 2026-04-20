# Edem Architecture — Key Ideas

## Core Vision

**Exodus is a self-hosting IDE for the Edem platform.**

Edem is a local-first, single-user, no-code/low-code platform for building desktop applications. Exodus itself is built entirely on Edem — it is not a separate application on top of Edem, but an application _inside_ Edem, created with the same tools available to any user.

---

## Key Principles

### 1. No Code for Data and Business Logic

- **Data** is defined through a visual collection/field constructor (not SQL or code)
- **Business logic** is defined through visual flow graphs (not scripts)
- **UI** is composed from primitives with data binding (not hand-written components)
- Everything else (behavior, automation, integrations) uses a base set of flow nodes

### 2. Event-Driven Modular Architecture

- All modules are independent and communicate **only through events** (Evento)
- No direct imports between modules (`@/modules/<other>` is forbidden)
- Each module owns its data (SQLite DB), events, translations, and logic
- Cross-module communication via event bus with type-safe Zod schemas

### 3. Separate DB per Module

- Each module has its own SQLite database file
- Benefits: complete isolation, easy add/remove, independent migrations, parallel access
- Trade-off: no cross-module transactions (eventual consistency is acceptable for single-user)

### 4. Self-Hosting (Exodus eats itself)

- Exodus is built on Edem runtime, just like any user app
- Exodus data (Projects, Ideas, Settings) lives in Data layer collections
- Exodus UI is rendered by UI engine
- Exodus logic is implemented as flows
- The IDE editors (Collection Editor, Flow Editor, UI Editor) are also Edem applications

---

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│  Electrobun (desktop shell — Bun + native webview)          │
├─────────────────────────────────────────────────────────────┤
│  Edem Runtime (core platform, written in TypeScript)        │
│  ├── Event Bus (Evento) — type-safe, cross-environment      │
│  ├── Module Loader — registration, lifecycle                │
│  ├── Data Engine — collections, fields, items, files        │
│  ├── Flow Engine — nodes, edges, execution                  │
│  ├── UI Engine — primitives, layouts, data binding          │
│  └── MCP Gateway — AI tools, generation                     │
├─────────────────────────────────────────────────────────────┤
│  Exodus App (built on Edem, same as any user app)           │
│  ├── Data: Projects collection, Ideas collection...         │
│  ├── Flows: business logic as visual graphs                 │
│  ├── UI: declarative pages rendered by UI Engine            │
│  └── Modules: logger, updater, settings...                  │
├─────────────────────────────────────────────────────────────┤
│  User Apps (also built on Edem)                             │
│  └── [any application created by the user]                  │
└─────────────────────────────────────────────────────────────┘
```

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
│   ├── index.ts       # Export module messages
│   └── {locale}.ts    # Per-locale translations
└── pages/             # Vue pages (if UI module)
```

---

## Event System (Evento)

- **Commands**: `{module}:{action}` — incoming requests (`data:create-item`)
- **Facts**: `{module}:{entity}-{result}` — outgoing notifications (`data:item-created`)
- **Errors**: `{module}:error` — structured errors with codes
- Every event carries: `source`, `depth` (loop protection), `trace_id`, `timestamp`
- Patterns: fire-and-forget, request-response, event-carried state transfer

---

## Database Design

- SQLite for all modules, WAL mode
- Each module manages its own migrations
- `ATTACH DATABASE` for cross-module queries when needed
- Content-addressable file storage (SHA256-based paths)

---

## Extensibility: Spec-Driven Handlers

Developers extend the platform by writing handlers according to a spec:

- **Event schema** (Zod) — contract for input/output
- **UI manifest** (optional) — how the node looks in Flow Editor
- Modules register their nodes/events at initialization
- MCP automatically exposes them as AI tools

---

## AI Integration (MCP)

- MCP is the gateway between Edem's event architecture and external AI agents
- Modules register their capabilities as "tools"
- AI agents call tools via JSON-RPC → MCP emits events → modules execute → results return
- AI can generate collections, UI pages, and flows from natural language descriptions

---

## Development Approach

**Evolutionary, not revolutionary:**

1. Build Edem Runtime modules (Data → Flows → UI → MCP)
2. Migrate existing Exodus features to Edem mechanisms
3. IDE editors become Edem applications
4. Exodus fully runs on Edem
5. Users can create their own applications

The goal is a platform where **the builder is built with the same tools it provides**.
