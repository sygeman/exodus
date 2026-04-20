# Evento — Schema Layer

## Registry

```typescript
import { createRegistry } from "@exodus/evento"
import { z } from "zod"

const registry = createRegistry("projects", {
  list: {
    schema: z.void(),
    response: z.object({ projects: z.array(ProjectSchema) }),
  },
  create: {
    schema: z.object({ name: z.string(), color: z.string().optional() }),
  },
})
```

## Schema Serialization

```typescript
const description = evento.serializeSchema("projects:list")
// { type: "void" }

const description = evento.serializeSchema("projects:create")
// { type: "object", properties: { name: { type: "string" }, color: { type: "string" } } }
```

## Schema Request

```typescript
evento.handle("schema:request", (ctx) => {
  const entry = evento.getSchema(ctx.payload.name)
  return {
    name: ctx.payload.name,
    schema: entry ? evento.serializeSchema(ctx.payload.name) : null,
  }
})
```
