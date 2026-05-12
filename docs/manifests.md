# Манифесты Edem — План перехода

> Цель: все 5 манифестов читаются в рантайме. Компоненты = чистые шаблоны. Вся логика — в flows.

## Текущее состояние

| Манифест | Рантайм | Статус |
|----------|---------|--------|
| data.json | `applyManifest()` при старте | Работает |
| flows.json | `applyManifest()` при старте | Работает |
| routes.json | Нет | Захардкожен в `router.ts` (14 импортов, 19 .vue файлов) |
| platform.json | Нет | Захардкожен в `bun/index.ts` |
| assets.json | Нет | Импорты в .vue файлах |

### Проблема: логика в компонентах

Сейчас .vue файлы содержат state, computed, helpers, business logic:

| Компонент | State | Logic |
|-----------|-------|-------|
| ProjectsListPage | `showSkeleton` | `handleCreate`, `getRandomColor`, `getInitials` |
| DebugLogs | `offset`, `levelFilter`, `sourceFilter`, `textFilter`, `copiedLogId` | `clear`, `firstPage/prevPage/nextPage/lastPage`, `copyLog`, `formatTime`, `formatArgs`, `levelBadgeColor` |
| SettingsAppearance | `isDark` (computed get/set) | — |
| SettingsLayoutPage | — | `navItems` (computed) |
| ProjectPage | — | `loadProject`, `loadIdeas` |
| IdeaPage | — | `loadIdea`, `updateIdea`, `deleteIdea` |

**Архитектурное решение:** Вся логика → flows. Компоненты = чистые шаблоны + биндинги.

## Целевая архитектура

```
edem-manifests/
├── data.json         ← описывает коллекции/поля
├── flows.json        ← описывает логику (включая UI-state)
├── routes.json       ← описывает маршруты + компоненты
├── components/       ← деревья компонентов (по одному JSON на компонент)
│   ├── ProjectsListPage.json
│   ├── DebugLogs.json
│   └── ...
├── platform.json     ← описывает boot-процесс и платформенные фичи
└── assets.json       ← описывает статические ресурсы
```

В рантайме:
1. `platform.json` → runtime читает и выполняет boot (окно, bridge, фичи)
2. `data.json` → `applyManifest()` создаёт коллекции
3. `flows.json` → `applyManifest()` регистрирует флоу (включая UI-flow)
4. `routes.json` → runtime строит Vue Router из JSON
5. `components/*.json` → `edem-vue/renderer` рендерит через `h()`

---

## Форматы манифестов

### Конвенция: `$type` как дискриминатор

Все вариативные типы используют `$type` как поле-дискриминатор:

| Тип | Формат |
|-----|--------|
| Перевод | `{ "$type": "translation", "en": "...", "ru": "..." }` |
| Flow-событие | `{ "$type": "flow", "id": "..." }` |
| Action-событие | `{ "$type": "action", "action": "...", "collection": "..." }` |
| Navigate-событие | `{ "$type": "navigate", "path": "..." }` |
| Flow trigger | `{ "$type": "event", ... }` / `{ "$type": "schedule", ... }` / `{ "$type": "ui", ... }` |

Префикс `$` гарантирует что поле не конфликтует с HTML-атрибутами или пропсами компонентов.

**Zod-валидация:**

```ts
const eventBindingSchema = z.discriminatedUnion("$type", [
  z.object({ $type: z.literal("flow"), id: z.string(), input: z.record(z.unknown()).optional() }),
  z.object({ $type: z.literal("action"), action: z.string(), collection: z.string().optional(), data: z.record(z.unknown()).optional() }),
  z.object({ $type: z.literal("navigate"), path: z.string() }),
])

const triggerSchema = z.discriminatedUnion("$type", [
  z.object({ $type: z.literal("event"), event: z.string(), filter: z.record(z.unknown()).optional() }),
  z.object({ $type: z.literal("schedule"), every: z.string(), at: z.string().optional(), days: z.array(z.enum([...])).optional() }),
  z.object({ $type: z.literal("ui"), component: z.string() }),
  z.object({ $type: z.literal("manual") }),
  z.object({ $type: z.literal("webhook"), path: z.string() }),
])
```

### 1. routes.json

Описывает структуру маршрутов приложения.

```json
{
  "routes": [
    { "path": "/", "redirect": "/projects" },
    {
      "path": "/projects",
      "root": "ProjectsListPage"
    },
    {
      "path": "/project/:id",
      "redirect": "/project/:id/overview",
      "root": "ProjectLayout",
      "children": [
        { "path": "overview", "root": "ProjectPage" },
        { "path": "ideas", "root": "ProjectIdeasPage" },
        { "path": "ideas/:ideaId", "root": "IdeaPage" },
        { "path": "settings", "root": "ProjectSettingsPage" }
      ]
    }
  ]
}
```

**Поля маршрута:**

| Поле | Тип | Описание |
|------|-----|----------|
| `path` | `string` | Путь (поддерживает `:param`) |
| `root` | `string?` | Имя компонента (PascalCase) для рендеринга |
| `redirect` | `string?` | Редирект на путь |
| `children` | `Route[]?` | Дочерние маршруты |
| `name` | `string?` | Имя маршрута (генерируется из path если не указано) |
| `props` | `boolean?` | Передавать ли route params как пропсы |

**Генерация Vue Router:**

```ts
// Runtime читает routes.json и генерирует:
const routes: RouteRecordRaw[] = manifest.routes.map(route => ({
  path: route.path,
  name: generateName(route.path),
  redirect: route.redirect,
  component: resolveComponent(route.root),  // из registry
  props: route.props,
  children: route.children?.map(...)
}))
```

### 2. components/*.json

Каждый компонент — отдельный JSON-файл с деревом `ComponentNode`.

**ComponentNode (расширенный):**

```json
{
  "component": "div",
  "props": { "class": "flex h-full flex-col p-8" },
  "children": [
    {
      "component": "h1",
      "props": { "class": "text-2xl font-bold" },
      "children": { "$type": "translation", "en": "Projects", "ru": "Проекты" }
    },
    {
      "component": "UButton",
      "events": { "click": { "$type": "flow", "id": "createProject" } },
      "children": { "$type": "translation", "en": "Create", "ru": "Создать" }
    }
  ]
}
```

**Поля ComponentNode:**

| Поле | Тип | Описание |
|------|-----|----------|
| `component` | `string` | HTML-тег (`div`) или PascalCase (`UButton`) |
| `props` | `Record<string, unknown>?` | Пропсы (поддерживает `{{ expr }}`) |
| `children` | `ComponentNode[] \| string \| Translation?` | Дочерние узлы |
| `events` | `Record<string, EventBinding>?` | Привязки событий |
| `bind` | `DataBinding?` | Итерация по коллекции |
| `if` | `string?` | v-if условие |
| `elseIf` | `string?` | v-else-if условие |
| `else` | `boolean?` | v-else маркер |
| `link` | `string?` | Обёртка в RouterLink |
| `modal` | `object?` | UModal-обёртка |
| `teleport` | `string?` | `<Teleport to="...">` |
| `transition` | `object?` | CSS-классы переходов |
| `namedSlots` | `Record<string, ComponentNode[]>?` | Именованные слоты |
| `skeleton` | `boolean?` | Skeleton-загрузчик |
| `empty` | `object?` | Состояние пустоты |

**EventBinding:**

```json
{ "$type": "flow", "id": "createProject" }
{ "$type": "flow", "id": "copyLog", "input": { "logId": "{{ item.id }}" } }
{ "$type": "action", "action": "updateItem", "collection": "projects", "data": { "title": "{{ newTitle }}" } }
{ "$type": "navigate", "path": "/project/{{ item.id }}/overview" }
```

**DataBinding:**

```json
{
  "collection": "projects",
  "sort": ["sort_order"],
  "filter": { "status": "active" },
  "item": {
    "component": "RouterLink",
    "props": { "to": "/project/{{ item.id }}" },
    "children": "{{ item.name }}"
  }
}
```

**Переводы:**

```json
{ "$type": "translation", "en": "Hello", "ru": "Привет" }
```

**Выражения:**

В prop-значениях и children: `{{ expr }}` — JavaScript-выражение в контексте рендеринга.

Контекст включает:
- `route` — параметры текущего маршрута
- `t()` — функция перевода
- `helpers` — вспомогательные функции (из flows)
- `collections` — данные коллекций (из edem-data)
- `singletons` — данные синглтонов (из edem-data)
- `handlers` — обработчики событий (flow triggers, navigation, CRUD actions)

### 3. platform.json

Описывает boot-процесс и платформенные фичи.

```json
{
  "platform": "electrobun",
  "boot": [
    { "step": "window", "config": { "title": "Exodus", "width": 1200, "height": 800 } },
    { "step": "bridge", "config": { "protocol": "rpc" } },
    { "step": "data", "config": {} },
    { "step": "flows", "config": {} },
    { "step": "features", "config": {} }
  ],
  "features": {
    "console-logger": {
      "enabled": true,
      "config": {
        "collection": "logs",
        "dedup": true,
        "dedupWindow": 1000
      }
    },
    "window-persistence": {
      "enabled": true,
      "config": {
        "singleton": "app_state",
        "fields": ["window_frame", "window_maximized"],
        "debounce": 300
      }
    },
    "system-detection": {
      "enabled": true,
      "config": {
        "singleton": "app_state",
        "fields": ["locale", "dark"]
      }
    },
    "devtools": {
      "enabled": true,
      "config": {
        "accelerator": "Cmd+Option+I"
      }
    },
    "splash": {
      "enabled": true,
      "config": { "duration": 1500 }
    },
    "wayland-workaround": {
      "enabled": true
    }
  }
}
```

**Boot-процесс:**

```ts
// Runtime читает platform.json и выполняет шаги последовательно:
for (const step of manifest.boot) {
  switch (step.step) {
    case "window": createWindow(step.config)
    case "bridge": createBridge(step.config)
    case "data": await ensureCollections(edem.data)
    case "flows": await ensureFlows(edem.flows)
    case "features": await initFeatures(manifest.features)
  }
}
```

**Фичи:**

Каждая фича — модуль в `packages/edem-platform/`:

| Фича | Описание | Пакет |
|------|----------|-------|
| `console-logger` | Логгер в webview с dedup, query, stats | `edem-platform/logger` |
| `window-persistence` | Сохранение размера/позиции окна | `edem-platform/window` |
| `system-detection` | Определение locale/theme ОС | `edem-platform/system` |
| `devtools` | Toggle DevTools | `edem-platform/devtools` |
| `splash` | Splash-screen при старте | `edem-platform/splash` |
| `wayland-workaround` | Исправление для WebKitGTK + NVIDIA | `edem-platform/wayland` |

Фича = модуль с функцией `init(config)`:

```ts
// packages/edem-platform/logger/index.ts
export function initLogger(config: LoggerConfig, edem: Edem) {
  edem.data.createItem({ collection_id: config.collection, data: entry })
}
```

---

## Потоки данных (flows) для UI

### Новая концепция: UI-flow

Flow может иметь тип `trigger: { "$type": "ui", "component": "..." }`. Такой flow:
- Привязан к конкретному компоненту
- Управляет локальным state (refs)
- Предоставляет computed-значения
- Предоставляет handlers (действия)

**Пример: DebugLogs flow:**

```json
{
  "id": "debug-logs",
  "name": "Debug Logs",
  "trigger": { "$type": "ui", "component": "DebugLogs" },
  "state": {
    "offset": 0,
    "levelFilter": "all",
    "sourceFilter": "all",
    "textFilter": "",
    "copiedLogId": null
  },
  "computed": {
    "page": "Math.floor(state.offset / PAGE_SIZE) + 1",
    "totalPages": "Math.max(1, Math.ceil(total.value / PAGE_SIZE))",
    "levelOptions": "[{ label: t({ en: 'All', ru: 'Все' }), value: 'all' }, ...]",
    "sourceOptions": "[{ label: 'All', value: 'all' }, { label: 'Bun', value: 'bun' }, ...]"
  },
  "helpers": {
    "PAGE_SIZE": 100,
    "formatTime": "(ts) => new Date(ts).toLocaleTimeString() + '.' + String(new Date(ts).getMilliseconds()).padStart(3, '0')",
    "formatArgs": "(args) => args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')",
    "levelBadgeColor": "(level) => { switch(level) { case 'error': return 'error'; ... } }"
  },
  "nodes": [
    { "id": "n1", "type": "trigger", "position": { "x": 0, "y": 0 } },
    { "id": "n2", "type": "action", "position": { "x": 100, "y": 0 }, "data": { "module": "data", "proc": "queryCollection" } }
  ],
  "edges": [{ "id": "e1", "source": "n1", "target": "n2" }],
  "actions": {
    "firstPage": { "set": { "offset": 0 } },
    "prevPage": { "set": { "offset": "Math.max(0, state.offset - PAGE_SIZE)" } },
    "nextPage": { "if": "state.offset + PAGE_SIZE < total.value", "set": { "offset": "state.offset + PAGE_SIZE" } },
    "lastPage": { "set": { "offset": "Math.max(0, (totalPages.value - 1) * PAGE_SIZE)" } },
    "clear": { "call": "edem.data.deleteItemsByFilter({ collection_id: 'logs', filter: {} })", "set": { "offset": 0 } },
    "copyLog": { "call": "navigator.clipboard.writeText(formatLogText(args[0]))", "set": { "copiedLogId": "args[0].id" } }
  }
}
```

### Контекст рендеринга

Когда рендерится компонент `DebugLogs`, runtime:
1. Находит flow с `trigger.component: "DebugLogs"`
2. Создаёт reactive state из `flow.state`
3. Вычисляет computed-значения
4. Собирает handlers из `flow.actions`
5. Передаёт всё в `RenderContext`

```ts
const flow = findFlowForComponent("DebugLogs")
const state = reactive(flow.state)  // { offset: ref(0), levelFilter: ref("all"), ... }
const computed = buildComputed(flow.computed, state, ctx)
const handlers = buildHandlers(flow.actions, state, edem)

const renderContext: RenderContext = {
  route: currentRoute.params,
  state,                          // локальный state флоу
  collections,                    // из edem-data
  singletons,                     // из edem-data
  helpers: { ...flow.helpers },   // из флоу
  handlers,                       // из флоу
  t                               // функция перевода
}
```

### Связь flows.json и компонентов

В `flows.json` добавляются UI-flow-и:

```json
{
  "flows": [
    { "id": "system-updater", "trigger": { "$type": "schedule", "every": "15m" }, ... },
    { "id": "debug-logs", "trigger": { "$type": "ui", "component": "DebugLogs" }, ... },
    { "id": "settings-appearance", "trigger": { "$type": "ui", "component": "SettingsAppearance" }, ... }
  ]
}
```

---

## План реализации

### Фаза 1: Рефактор .vue файлов (flows для логики)

**Цель:** Все .vue файлы содержат только шаблон. Вся логика — в flows.

**Шаг 1.1:** Определить UI-flow для каждого компонента:

| Компонент | Flow ID | State | Actions |
|-----------|---------|-------|---------|
| ProjectsListPage | `projects-list` | `showSkeleton` | `createProject` |
| ProjectLayout | `project-layout` | `project`, `loading` | `loadProject` |
| ProjectPage | `project-page` | `project`, `ideas` | `loadProject`, `loadIdeas` |
| ProjectIdeasPage | `project-ideas` | `ideas`, `loading` | `loadIdeas` |
| IdeaPage | `idea` | `idea`, `loading` | `loadIdea`, `updateIdea`, `deleteIdea` |
| ProjectSettingsPage | `project-settings` | `project` | `loadProject`, `updateProject` |
| DebugLogs | `debug-logs` | `offset`, `levelFilter`, `sourceFilter`, `textFilter`, `copiedLogId` | `firstPage`, `prevPage`, `nextPage`, `lastPage`, `clear`, `copyLog` |
| DebugState | `debug-state` | `state` | `loadState` |
| SettingsAppearance | `settings-appearance` | `isDark` | `toggleDark` |
| SettingsLanguage | `settings-language` | `locale`, `locales` | `setLocale` |
| SettingsLayoutPage | `settings-layout` | `navItems` | — |
| AppSidebar | `app-sidebar` | — | — |
| ProjectsSidebar | `projects-sidebar` | `projects` | `loadProjects` |

**Шаг 1.2:** Создать flows в `flows.json` с `trigger.type: "ui"`.

**Шаг 1.3:** Рефакторить .vue файлы:
- Удалить `ref()`, `computed()`, `watch()`
- Удалить helper-функции
- Заменить `useCollectionQuery` на `bind.collection`
- Заменить `useCreateItem` / `useUpdateItem` / `useDeleteItem` на `{ "$type": "action", ... }`
- Заменить `edem.flows.trigger(...)` на `{ "$type": "flow", ... }`
- Оставить только шаблон + пропсы + биндинги

**Шаг 1.4:** Верифицировать что приложение работает идентично.

### Фаза 2: Конвертация в JSON

**Цель:** Заменить .vue файлы на components/*.json + runtime renderer.

**Шаг 2.1:** Создать `edem-manifests/components/` с JSON-файлами для каждого компонента.

**Шаг 2.2:** Расширить `edem-vue/renderer`:
- Поддержка UI-flow (state, computed, helpers)
- Поддержка `bind.collection` (загрузка данных из edem-data)
- Поддержка `bind.filter`, `bind.sort`
- Поддержка action events (`updateItem`, `deleteItem`, `createItem`)
- Поддержка named slots для layout-компонентов

**Шаг 2.3:** Создать runtime-роутер:
- Читает `routes.json`
- Резолвит компоненты из `components/*.json`
- Регистрирует Vue-роуты динамически

**Шаг 2.4:** Удалить .vue файлы и ручной `router.ts`.

**Шаг 2.5:** Верифицировать что приложение работает идентично.

### Фаза 3: platform.json boot

**Цель:** Полный бутстрап из platform.json.

**Шаг 3.1:** Создать `edem-platform/` — модули для каждой фичи:
- `edem-platform/logger` — webview-side логгер
- `edem-platform/window` — persistence размера/позиции окна
- `edem-platform/system` — определение locale/theme
- `edem-platform/devtools` — toggle DevTools
- `edem-platform/splash` — splash-screen
- `edem-platform/wayland` — workaround для WebKitGTK

**Шаг 3.2:** Создать boot-рунтайм:
- Читает `platform.json`
- Последовательно выполняет шаги из `boot[]`
- Инициализирует фичи из `features`

**Шаг 3.3:** Переписать `bun/index.ts`:
- Заменить хардкод на чтение `platform.json`
- Удалить прямые вызовы фич

**Шаг 3.4:** Создать `edem-manifests/platform.json` в `apps/exodus`.

**Шаг 3.5:** Верифицировать что приложение работает идентично.

### Фаза 4: Документация

**Шаг 4.1:** Обновить `architecture.md`:
- Описать форматы всех 5 манифестов
- Описать runtime-рендеринг
- Описать boot-процесс

**Шаг 4.2:** Обновить `stages.md`:
- Отметить выполнение стадии 1-2
- Описать gaps которые закрыты

---

## Зависимости

```
Фаза 1 (рефактор .vue) ──→ Фаза 2 (конвертация в JSON)
                              ↓
Фаза 3 (platform boot) ──→ Фаза 4 (документация)
```

Фаза 3 независима от фаз 1-2 и может выполняться параллельно.

---

## Открытые вопросы

1. **Реактивность в UI-flow:** Как flow-engine связывает `state.offset` с `ref(0)` в контексте рендеринга? Нужен ли watcher или достаточно computed?

2. **Загрузка данных:** `bind.collection` подразумевает автоматическую загрузку из edem-data. Нужно ли указывать `filter`/`sort` в bind или они берутся из computed флоу?

3. **Layout-компоненты:** `MenuLayout`, `SettingsLayout` используют named slots. Как передавать slot-контент из JSON? (`RouterView` в `namedSlots.default`)

4. **Кэширование выражений:** `evalExpr` уже имеет кэш. Нужно ли кэшировать деревья компонентов?

5. **Hot reload:** При редактировании JSON-компонентов в dev-режиме нужен ли HMR для JSON-файлов?
