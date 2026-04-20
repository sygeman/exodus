# Evento

Type-safe event bus для архитектуры Edem.

## API

```typescript
import { Evento } from "@exodus/evento"

const evento = new Evento<"bun", ["webview"]>("bun", "webview")
```

### Подписка

```typescript
evento.on("counter:increment", (ctx) => {
  // ctx.name — имя события
  // ctx.payload — данные (без meta)
  // ctx.meta — EventMeta (source, depth, trace_id, timestamp, environment)
  // ctx.segments — сегменты имени события
});

// Однократная подписка
evento.once("user:login", (ctx) => { ... });

// Wildcard patterns
evento.on("user:*", (ctx) => { ... });     // user:login, user:logout
evento.on("user:**", (ctx) => { ... });    // любая глубина
evento.on("*:update", (ctx) => { ... });   // любое update событие
```

### Отписка

```typescript
const unsubscribe = evento.on("event", handler)
unsubscribe()

evento.off(handler) // отписать от всех событий
evento.offAll("event") // отписать все handler'ы от события
evento.offAll() // отписать всё
```

### Отправка событий

```typescript
// Новое событие (начало цепочки)
evento.emitEvent("counter:increment", { count: 5 }, "user:click_btn")
// auto: depth=0, trace_id=uuid, timestamp=Date.now()

// Void событие
evento.emitEvent("timer:tick", "system:timer_001")

// Ответное событие внутри handler'а (пробрасывает trace_id, инкрементит depth)
evento.on("counter:increment", (ctx) => {
  evento.forward("counter:updated", { count: 5 }, ctx)
})
```

### Request-Response

```typescript
// Запрос
const data = await evento.request("settings:query", { keys: ["theme"] }, { timeout: 200 })

// Ответ через handle (авто-reply)
evento.handle("settings:query", (ctx) => {
  return { theme: "dark" }
})

// Или вручную через reply
evento.on("settings:query", (ctx) => {
  evento.reply(ctx, { theme: "dark" })
})
```

### Loop Detection

- `MAX_EVENT_DEPTH = 25` — максимальная глубина цепочки
- `DEPTH_WARNING_THRESHOLD = 20` — предупреждение при приближении к лимиту
- При превышении: событие отклоняется, эмитится `evento:error`

## Тесты = Требования

Все тесты в `src/tests/` являются спецификацией поведения:

```bash
bun test
```

### Структура тестов

- `core.test.ts` — базовые операции (on, off, once, wildcard matching)
- `payload-schema.test.ts` — EventMeta, emitEvent, forward
- `source-and-loop.test.ts` — source propagation, depth limit, trace_id
- `request-response.test.ts` — request/reply, correlation_id, timeout
- `error-handling.test.ts` — AppError structure, error codes, global listener
- `utils.test.ts` — splitSegments, matchPattern

## Event Payload Schema

Все события содержат EventMeta отдельно от payload:

```typescript
type EventMeta = {
  source: string // "{origin}:{id}" — кто инициировал
  depth: number // 0 для user action, +1 при forward
  trace_id: string // uuid цепочки
  timestamp: number // Date.now()
}

type EventoHandlerContext<E, P> = {
  name: string
  payload: P // только пользовательские данные
  meta: EventMeta & { environment: E }
  segments: string[]
}
```

## Error Codes

- `DEPTH_EXCEEDED` — превышена глубина цепочки
- `VALIDATION_ERROR`, `FIELD_REQUIRED`, `FIELD_INVALID`
- `NOT_FOUND`, `ALREADY_EXISTS`, `CONFLICT`
- `INVALID_STATE`, `INVALID_TRANSITION`
- `RATE_LIMITED`, `BACKPRESSURE_LIMIT`, `TIMEOUT`
- `INTERNAL_ERROR`, `DB_ERROR`

## Cross-Environment

Для работы между bun и webview создайте адаптеры в приложении:

```typescript
// bun/evento.ts
import { Evento } from "@exodus/evento"

const evento = new Evento<"bun", ["webview"]>("bun", "webview")
evento.sender = webview.rpc?.send?.emit

// webview/evento.ts  
import { Evento } from "@exodus/evento"

const evento = new Evento<"webview", ["bun"]>("webview", "bun")
// RPC адаптер вызывает evento.emitLocal()
```

`emitLocal` — для приёма событий из другого окружения.
