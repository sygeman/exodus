# Plugin/Module System

## Overview

Modules are independent units that extend the system. Each module owns its data, events, and logic.

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

## Event-Driven Communication

Modules communicate ONLY through events. No direct state access.

```typescript
// Module A sends event
emit("data:query_items", {
    collection_id: "xxx",
    correlation_id: crypto.randomUUID()
})

// Module B listens
on("data:query_items", (event) => {
    const payload = parse(event.payload)
    // ... process
    emit("data:items_result", { ... })
})
```

## Module Lifecycle

### Initialization

```typescript
// bun.ts
export function initModule(evento: EventoBun) {
    // 1. Initialize DB
    migrate()
    
    // 2. Register events
    evento.register(moduleRegistry)
    
    // 3. Register handlers
    evento.handle("module:query", handleQuery)
    evento.on("module:action", handleAction)
    
    // 4. Start background tasks (optional)
    startBackgroundTask()
}
```

### Background Tasks

```typescript
function startBackgroundTask() {
    setInterval(() => {
        // Periodic task
    }, 60000)
}
```

## Event Naming

### Commands (Incoming)

```
{module}:{action}

settings:set
data:create_item
flows:run
```

### Results (Outgoing)

```
{module}:{entity}_{action}

settings:changed
data:item_created
flows:run_completed
```

### Errors

```
{module}:error

data:error
flows:error
```

## Payload Structure

All events must include tracing fields:

```typescript
{
  source: string,     // "{origin}:{id}" — who initiated
  depth: number,      // 0-25 — loop protection
  trace_id: string,   // uuid — links chain
  timestamp: number   // unix ms
}
```

## Example Implementation

### Bun Side (bun.ts)

```typescript
import type { EventoBun } from "@/bun/evento"

export function initSettings(evento: EventoBun) {
    // Init DB
    migrate()
    
    // Register events
    evento.register(settingsRegistry)
    
    // Handle queries
    evento.handle("settings:query", (ctx) => {
        const result = {}
        for (const key of ctx.payload.keys) {
            result[key] = getSetting(key)
        }
        return result
    })
    
    // Handle updates
    evento.on("settings:set", (ctx) => {
        const oldValue = getSetting(ctx.payload.key)
        setSetting(ctx.payload.key, ctx.payload.value)
        
        // Emit change event
        evento.emitEvent("settings:changed", {
            key: ctx.payload.key,
            old_value: oldValue,
            new_value: ctx.payload.value
        }, ctx.meta.source)
    })
}
```

### Webview Side (webview.ts)

```typescript
import { evento } from "@/evento"
import { ref, onMounted, onUnmounted } from "vue"

export function useSettings() {
    const settings = ref({})
    let unsubscribe: (() => void) | null = null
    
    onMounted(async () => {
        // Load initial settings
        const result = await evento.request("settings:query", {
            keys: ["theme", "language"]
        })
        settings.value = result
        
        // Listen for changes
        unsubscribe = evento.on("settings:changed", (ctx) => {
            settings.value[ctx.payload.key] = ctx.payload.new_value
        })
    })
    
    onUnmounted(() => {
        unsubscribe?.()
    })
    
    function setSetting(key: string, value: unknown) {
        evento.emitEvent("settings:set", { key, value }, "user:ui")
    }
    
    return { settings, setSetting }
}
```

## Module Boundaries

### Allowed Imports

- Within same module (`./`, `../` inside `src/modules/{name}/`)
- From `src/components/`
- From `src/composables/`
- From third-party packages

### Forbidden Imports

- `from "@/modules/{other-module}/..."`

### Shared Code

If multiple modules need the same code, extract to:
- `src/components/` — shared Vue components
- `src/composables/` — shared Vue composables
- `src/lib/` — shared utilities

## Module i18n

Each module owns its translations.

```typescript
// i18n/en.ts
export const settingsMessages = {
  common: {
    // Keys used only by this module
  },
  settings: {
    // Module-specific namespace
    title: "Settings",
    theme: "Theme",
    language: "Language"
  }
}

// i18n/index.ts
import { settingsMessages } from "./en"
export { settingsMessages }
```

### Rules

- Export naming: `export const {name}Messages = { ... }`
- Structure: `common` (module-only keys), `{name}` (module namespace)
- Do NOT use generic namespaces (e.g., `logs`, `events`) for module-specific keys
- Global `src/locales/*.ts` only for truly global keys

## Coding Standards

### Logging

Use structured logging, not console.log:

```typescript
// Good
console.log("[module] action completed", { item_id, duration })

// Avoid
console.log("done")
```

### Errors

Use structured errors with codes:

```typescript
// Good
throw {
  code: "NOT_FOUND",
  message: `Item ${id} not found`,
  details: { entity: "item", entity_id: id }
}

// Avoid
throw new Error("not found")
```

### Async

Use async/await, handle errors:

```typescript
// Good
async function processItem(id: string) {
  try {
    const item = await getItem(id)
    return transform(item)
  } catch (error) {
    console.error("[module] process failed", { id, error })
    throw error
  }
}

// Avoid
function processItem(id: string) {
  getItem(id).then(item => transform(item))
}
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
