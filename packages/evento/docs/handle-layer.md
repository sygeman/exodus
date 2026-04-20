# Evento — Handle Layer

## Auto-Reply Pattern

```typescript
evento.handle("projects:list", () => {
  return { projects: listProjects() }
})
```

- Возвращаемое значение автоматически отправляется как reply
- `undefined`/`void` → reply не отправляется
- Promise поддерживается

## Manual Reply

```typescript
evento.on("projects:list", (ctx) => {
  const projects = listProjects()
  evento.reply(ctx, { projects })
})
```

## Void Handle

```typescript
evento.handle("logger:clear", (ctx) => {
  clearLogs(ctx.payload.source)
  // no return = no reply
})
```

## Error Handling

```typescript
evento.handle("projects:create", (ctx) => {
  try {
    return createProject(ctx.payload)
  } catch (err) {
    // Ошибка перехватывается evento, эмитится evento:error
    throw err
  }
})
```
