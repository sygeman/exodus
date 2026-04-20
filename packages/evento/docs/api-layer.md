# Evento — API Layer

## Request-Response Pattern

```typescript
// Запрос с таймаутом
const data = await evento.request("settings:query", { keys: ["theme"] }, { timeout: 200 })

// Handle с авто-reply
evento.handle("settings:query", (ctx) => {
  return { theme: "dark" }
})

// Ручной reply
evento.on("settings:query", (ctx) => {
  evento.reply(ctx, { theme: "dark" })
})
```

## Handle Layer

```typescript
// Авто-reply: возвращаемое значение → ответ
evento.handle("projects:list", () => {
  return { projects: listProjects() }
})

// Void handle: без ответа
evento.handle("logger:clear", (ctx) => {
  clearLogs(ctx.payload.source)
})
```

## Registry

```typescript
import { createRegistry } from "@exodus/evento"
import { z } from "zod"

const projectsRegistry = createRegistry("projects", {
  list: {
    schema: z.void(),
    response: z.object({ projects: z.array(ProjectSchema) }),
  },
  create: {
    schema: z.object({ name: z.string(), color: z.string().optional() }),
  },
})
```
