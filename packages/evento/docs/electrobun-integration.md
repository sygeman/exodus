# Evento — Electrobun Integration

## Bun Side

```typescript
import { Evento } from "@exodus/evento"
import { BrowserView } from "electrobun/bun"

const evento = new Evento<"bun", ["webview"]>("bun", "webview")

const rpc = BrowserView.defineRPC<{
  bun: RPCSchema<{ messages: { emit: { name: string; payload: unknown; meta: EventoMeta } } }>
  webview: RPCSchema<{ messages: { emit: { name: string; payload: unknown; meta: EventoMeta } } }>
>({
  handlers: {
    messages: {
      emit: (msg) => {
        evento.emitLocal(msg.name, msg.payload, msg.meta)
      },
    },
  },
})

// Отправка в webview
evento.sender = webview.rpc?.send?.emit
```

## Webview Side

```typescript
import { Evento } from "@exodus/evento"
import { Electroview } from "electrobun/view"

const evento = new Evento<"webview", ["bun"]>("webview", "bun")

const rpc = Electroview.defineRPC<{
  bun: RPCSchema<{ messages: { emit: { name: string; payload: unknown; meta: EventoMeta } } }>
  webview: RPCSchema<{ messages: { emit: { name: string; payload: unknown; meta: EventoMeta } } }>
>({
  handlers: {
    messages: {
      emit: (msg) => {
        evento.emitLocal(msg.name, msg.payload, msg.meta)
      },
    },
  },
})

// Отправка в bun
evento.sender = (msg) => electroview.rpc?.send?.emit(msg)
```

**Сигнатура `createEventoBun`:**

```typescript
function createEventoBun(): {
  evento: Evento<"bun", ["webview"]>
  rpc: RPC
}
```
