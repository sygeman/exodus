# Exodus Architecture

## What is Exodus

Exodus is an IDE for building applications on the Edem architecture. Exodus itself is an Edem application.

This creates a self-referential architecture: Exodus reads its own schema from SQLite, builds itself, and the result is the same application. `build(exodus) = exodus`.

## Core Principle

All Edem artifacts are **declarative manifests**. Nothing is compiled into code. The same runtime interprets all projects.

```
Artifact = Schema manifest (JSON) + Flows manifest (JSON) + UI manifest (JSON) + Runtime + Environment
```

| Component | Format | Example |
|-----------|--------|---------|
| Schema | Declarative JSON | Collections, fields, relations, validations |
| Flows | Declarative JSON | Graph of nodes, triggers, connections |
| UI | Declarative JSON | Pages, components, bindings to data/flows |
| Runtime | JS bundle | `edem-core` + `edem-data` — same for all projects |
| Environment | Platform wrapper | Electrobun (desktop), browser (web), CLI |

## Project Types

A project has a **type** that determines the build output:

| Type | Environment | Output |
|------|-------------|--------|
| Desktop app | Electrobun | Native `.app` with embedded edem |
| Web app | Browser | HTML/JS bundle served as static files |
| CLI | Node/Bun | Executable script |
| Library | NPM package | Published package |

Exodus itself is a **desktop app** (Electrobun).

## Lifecycle

### 1. Development (inside Exodus)

All manifests live in SQLite as data. The edem-data module stores everything:

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

Flows and UI are stored as **items in dedicated collections**. They are data, not code. The Data editor, Flow editor, and UI editor are all CRUD interfaces on these collections.

### 2. Build

Read manifests from SQLite, package into artifact:

```
input:  SQLite (project_id)
output: dist/
        ├── schema.json    ← collections + fields + relations
        ├── flows.json     ← flow graphs
        ├── ui.json        ← pages + components
        ├── runtime.js     ← edem-core + edem-data bundle
        └── app            ← environment wrapper (Electrobun app / HTML / etc.)
```

### 3. Runtime (on user's machine)

The built application runs with:

- **Manifests** baked into the build (schema, flows, UI)
- **Runtime** interprets manifests — renders UI, validates data, executes flows
- **Data SQLite** created on first launch — empty database matching the schema
- **Updates** deliver new manifests → runtime hot-reloads or restarts

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
│   ├── settings { key, value, type }
│   ├── logs { level, message, timestamp, source }
│   ├── app_state { key, value }
│   ├── projects { name, slug, color, ... }
│   ├── flows { name, nodes, triggers }
│   └── pages { path, components }
│
└── items
    ├── settings: [{ dark_mode: true }, ...]
    ├── logs: [...]
    └── ...
```

When Exodus builds itself:
1. Reads its own project from SQLite
2. Extracts schema, flows, UI manifests
3. Packages with edem runtime + Electrobun
4. Result = same Exodus application

This means:
- **Bootstrap**: First version has hardcoded initial schema in `init.ts`
- **Self-modification**: User can modify Exodus's schema → next build includes changes
- **Chicken-and-egg**: `init.ts` creates the initial structure that the rest of the app reads

## Current State vs Target

### Current

- `edem-data` has `projects` as first-class entity with CRUD
- `collections` / `fields` define schema, stored in SQLite
- `items` store data as JSON blobs
- `templates` table exists but no CRUD
- `modules/projects/webview.ts` uses edem directly
- No flow editor, no UI editor
- Build produces Electrobun app via hardcoded config

### Target

- `edem-data` is the universal manifest store
- `projects` is a core concept (every manifest set belongs to a project)
- Flows and UI are items in system collections
- Build reads manifests from SQLite, produces artifact
- Runtime interprets manifests (no code generation)
- Exodus is a project in itself

## Open Questions

1. **Schema manifest format**: How exactly are collections/fields serialized to JSON? Current `schema.ts` Drizzle definitions vs runtime JSON?

2. **UI manifest format**: What does a page/component JSON look like? How are bindings to data expressed?

3. **Flows manifest format**: What does a flow graph JSON look like? What node types exist?

4. **Runtime rendering**: How does the runtime render UI from JSON? Vue components generated at runtime? Custom renderer?

5. **Flow execution**: How does the runtime execute flows? Interpreter for the node graph? Or compile to JS at build time?

6. **Data migration**: When schema changes between builds, how are existing user databases migrated?

7. **Exodus protection**: Should certain collections in the Exodus project be protected from user modification?

8. **Multiple projects**: Can multiple projects share data? Cross-project relations?

## Implementation Path

Rough order of work:

1. **Define manifest formats** — JSON schemas for schema, flows, UI
2. **Manifest storage** — ensure edem-data can store manifests as items in system collections
3. **Build pipeline** — read manifests from SQLite, produce JSON files
4. **Runtime manifest loader** — runtime reads JSON manifests on startup
5. **UI renderer** — render pages/components from UI manifest
6. **Flow engine** — execute flow graphs from flows manifest
7. **Exodus self-build** — Exodus builds itself from its own manifests
8. **Editors** — Data editor (done), Flow editor, UI editor
