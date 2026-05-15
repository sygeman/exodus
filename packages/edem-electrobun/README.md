# Edem Electrobun

Desktop runtime bridge для Edem — связь Bun backend и Electrobun webview через RPC.

## Обзор

Пакет реализует two-sided bridge: bun-side (серверный процесс) и webview-side (браузерный процесс). Общаются через typed message protocol: `request`, `response`, `event`.

```
[Webview]                          [Bun]
createWebviewEdemBridge()          createBunEdemBridge(edem, modules)
  .attachBun(send)  <---------->    .attachWebview(webview)
  .workerFactory(ctx)               .handler(msg)
  .handler(msg)
```

## Установка

```typescript
// Bun-side (сервер)
import { createBunEdemBridge } from "@exodus/edem-electrobun/bun"
import { setElectrobunDeps } from "@exodus/edem-electrobun/module"
import { bunLogger } from "@exodus/edem-electrobun/logger-bun"
import { getSystemLocale, getSystemTheme } from "@exodus/edem-electrobun/system"
import { onWindowFrameChange } from "@exodus/edem-electrobun/window"

// Webview-side (клиент)
import { createWebviewEdemBridge } from "@exodus/edem-electrobun/webview"
import { initLogs } from "@exodus/edem-electrobun/logger-webview"
```

## API

### Bun-side bridge

```typescript
import { createBunEdemBridge } from "@exodus/edem-electrobun/bun"

const { handler, attachWebview, onWebviewEvent } = createBunEdemBridge(edem, modules)

// Обработка сообщений от webview
handler(msg) // EdemMsg

// Подключение webview
attachWebview(webview)

// Обработка событий от webview
onWebviewEvent((name, payload) => { /* ... */ })
```

### Webview-side bridge

```typescript
import { createWebviewEdemBridge } from "@exodus/edem-electrobun/webview"

const { workerFactory, emitEvent, handler, attachBun } = createWebviewEdemBridge()

// Подключение к bun-side
attachBun(send)

// Создание worker'а для модуля
const worker = workerFactory({ module: "data" })
await worker.request("queryItems", { collection_id: "..." })
worker.subscribe("itemCreated", (event) => { /* ... */ })
```

### Message protocol

```typescript
type EdemRequestMsg = {
  type: "request"
  module: string      // имя модуля
  proc: string        // имя процедуры
  input: unknown      // входные данные
  id: string          // уникальный ID для корреляции
}

type EdemResponseMsg = {
  type: "response"
  id: string          // коррелирует с request ID
  result?: unknown
  error?: string
}

type EdemEventMsg = {
  type: "event"
  module: string
  name: string
  payload: unknown
}
```

### Electrobun модуль

Встроенный Edem-модуль для auto-updater:

```typescript
import { electrobunModule, setElectrobunDeps } from "@exodus/edem-electrobun/module"

setElectrobunDeps({ Updater: updaterAPI })

// Процедуры модуля
await edem.electrobun.getVersion()      // query → { version }
await edem.electrobun.checkUpdate()     // mutation → { available, current_version, latest_version }
await edem.electrobun.startUpdate()     // mutation → { success }
edem.electrobun.updateStatus(handler)   // subscription → { status, current_version, latest_version, error }
```

### Window persistence

```typescript
import { onWindowFrameChange } from "@exodus/edem-electrobun/window"

onWindowFrameChange(win, (data) => {
  // data = { frame: { x, y, width, height }, maximized?: boolean }
  persistFrame(data.frame)
}, { debounce: 300 })
```

### System detection

```typescript
import { getSystemLocale, getSystemTheme } from "@exodus/edem-electrobun/system"

const locale = getSystemLocale()  // "en-US", "ru-RU"
const isDark = getSystemTheme()   // true = dark, false = light
```

### Logging

```typescript
// Bun-side
import { bunLogger } from "@exodus/edem-electrobun/logger-bun"
bunLogger.attach((entry) => store.add(entry))

// Webview-side
import { initLogs } from "@exodus/edem-electrobun/logger-webview"
initLogs((entry) => store.add(entry))
```

Тип лога:

```typescript
type LogEntry = {
  timestamp: number
  level: "debug" | "info" | "warn" | "error"
  source: "bun" | "webview"
  message: string
  args: unknown[]
  count?: number  // дедупликация
}
```

## Экспорты

```typescript
// Типы
export type { EdemMsg, EdemRequestMsg, EdemResponseMsg, EdemEventMsg }

// Модуль
export { electrobunModule, setElectrobunDeps }
export type { ElectrobunDeps }

// Window
export { onWindowFrameChange }

// System
export { getSystemLocale, getSystemTheme }
```

## Subpath imports

| Импорт | Описание |
|--------|----------|
| `@exodus/edem-electrobun` | Основной API |
| `@exodus/edem-electrobun/bun` | Bun-side bridge |
| `@exodus/edem-electrobun/webview` | Webview-side bridge |
| `@exodus/edem-electrobun/types` | Message protocol типы |
| `@exodus/edem-electrobun/module` | Electrobun Edem-модуль |
| `@exodus/edem-electrobun/window` | Window frame tracking |
| `@exodus/edem-electrobun/system` | System locale/theme |
| `@exodus/edem-electrobun/logger-bun` | Bun-side logger |
| `@exodus/edem-electrobun/logger-webview` | Webview-side logger |
