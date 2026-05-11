# Архитектура Edem

> Стадии развития и процесс см. в [stages.md](./stages.md)

## Видение

Edem — фреймворк для **декларативных приложений**. Разработчик описывает приложение через JSON-манифесты. Codegen генерирует готовый код.

```
Манифесты → Codegen → Готовое приложение
```

Разработчик **объявляет**, никогда не пишет код:
- **data.json** — какие данные существуют, какие поля, какие связи
- **flows.json** — что происходит когда (триггеры → действия)
- **routes.json** — маршруты, навигация, компоненты (UI)
- **platform.json** — платформенные фичи (логгер, апдейтер, persistence)
- **assets.json** — статические ресурсы (иконки, SVG)

## Принципы

1. **Декларативность** — разработчик описывает, codegen генерирует
2. **Разделение** — данные, логика, представление отделены друг от друга
3. **Фреймворк-агностичность** — манифесты не привязаны к Vue/React/Svelte
4. **Самореферентность** — приложение собирает себя из своих же данных

## Артефакт

```
Артефакт = 5 манифестов + Codegen + Runtime + Renderer + Среда
```

| Компонент | Формат | Описание |
|-----------|--------|----------|
| data.json | Декларативный JSON | Коллекции, поля, связи, валидации |
| flows.json | Декларативный JSON | Граф нод, триггеры, соединения |
| routes.json | Декларативный JSON | Маршруты, навигация, компоненты |
| platform.json | Декларативный JSON | Логгер, апдейтер, persistence, devtools |
| assets.json | Декларативный JSON | Статические ресурсы |
| Codegen | CLI / Модуль | Генерирует приложение из манифестов |
| Runtime | JS bundle | edem-core + модули edem |
| Renderer | Фреймворк-специфичный | Компоненты Vue / React / Svelte |
| Окружение | Обёртка платформы | Electrobun (десктоп), браузер, CLI |

## Архитектура

```
Манифесты (5 JSON-файлов)
        ↓
    Codegen (edem-codegen)
        ├── Генерирует boilerplate (manifest.ts, flows-bootstrap, bridge)
        ├── Генерирует platform-код (logger, app-state, updater)
        ├── Генерирует composables (use{Collection})
        ├── Генерирует компоненты (.vue из component trees)
        └── Генерирует конфиги (vite, electrobun, router)
        ↓
    Готовое приложение
    ├── edem-core      — контракт коммуникации
    ├── edem-data      — хранение данных
    ├── edem-flows     — бизнес-логика
    ├── edem-ui        — представление
    └── Platform       — Electrobun / Browser / CLI
        ↓
    Standalone-приложение
```

## Пакеты Edem

| Пакет | Роль |
|-------|------|
| edem-core | Система модулей, RPC, абстракция воркера |
| edem-data | Коллекции, items, поля — мета-уровень |
| edem-flows | Триггеры, ноды, действия, DAG-движок |
| edem-ui | Интерпретация UI, резолвинг компонентов |
| edem-electrobun | Мост Bun ↔ Webview (RPC bridge) |
| edem-codegen | Генератор приложений из манифестов |

## edem-data как мета-уровень

edem-data — фундамент. Он сам описывает себя — хранит собственную схему в своих таблицах.

### Bootstrap-таблицы (захардкожены в edem-data)

Эти таблицы существуют на мета-уровне. Они НЕ являются коллекциями — они определяют, ЧТО ТАКОЕ коллекции.

| Таблица | Назначение |
|---------|------------|
| collections | Мета-схема: какие коллекции существуют |
| fields | Мета-схема: какие поля у каждой коллекции |
| items | Хранение данных: items в коллекциях |

### Системные возможности (в edem-data)

Это встроенные механизмы, не коллекции. Работают с items.

| Таблица | Назначение |
|---------|------------|
| relations | Связи между items разных коллекций |
| itemVersions | История версий items |
| itemLocks | Пессимистичная блокировка для параллельного редактирования |
| files | Хранение файлов по содержимому (content-addressed) |
| itemFiles | Связь items и файлов |
| fileThumbnails | Варианты миниатюр (small/medium/large) |
| fieldMigrations | Отслеживание эволюции схемы |

## Разработка vs Рантайм

edem-data работает в двух режимах:

### Режим разработки (внутри Exodus)

Как Directus — динамическая схема, полный CRUD на мета-уровне:

- Создание/изменение/удаление коллекций и полей
- Добавление/удаление items в любой коллекции
- Изменения схемы мгновенны (без ALTER TABLE)
- Все манифесты хранятся в SQLite как данные
- Редактор данных, редактор потоков, редактор UI — CRUD-интерфейсы

### Режим рантайма (собранное приложение)

Схема фиксирована, только операции с данными:

- Схема загружается из манифеста — не может быть изменена
- Только CRUD по items в существующих коллекциях
- Валидация данных по фиксированной схеме
- Нет динамического создания коллекций
- SQLite только для данных пользователя

```
РАЗРАБОТКА                          РАНТАЙМ
┌─────────────────────┐              ┌─────────────────────┐
│ Динамическая схема   │    BUILD    │ Фиксированная схема │
│ Полный CRUD          │ ──────────→ │ Только CRUD данных  │
│ Манифесты в SQLite   │             │ Манифесты в JSON    │
│ edem-data = движок   │             │ edem-data = валидатор│
└─────────────────────┘              └─────────────────────┘
```

## Жизненный цикл

### 1. Разработка (внутри Exodus)

Все манифесты живут в SQLite как данные:

```
SQLite (edem-data)
├── collections (схема данных)
│   ├── tasks { title: string, status: string, ... }
│   └── users { name: string, email: string, ... }
│
├── items (схема потоков)
│   └── коллекция "flows"
│       ├── flow_1 { trigger: item.created, nodes: [...] }
│       └── flow_2 { trigger: schedule, nodes: [...] }
│
└── items (схема UI)
    └── коллекция "pages"
        ├── "/" { components: [list, nav, ...] }
        └── "/task/:id" { components: [detail, form, ...] }
```

### 2. Codegen

Читает манифесты из SQLite, генерирует код:

```
вход:  Манифесты (data.json + flows.json + routes.json + platform.json + assets.json)
        ↓
    Codegen (edem-codegen)
        ├── parseManifests() → IR (Intermediate Representation)
        ├── validateIR() → ошибки/предупреждения
        └── stages[] → OutputFile[]
        ↓
выход: dist/
        ├── src/
        │   ├── manifest.ts          ← dataStage
        │   ├── flows-manifest.ts    ← flowsStage
        │   ├── flows-bootstrap.ts   ← flowsStage
        │   ├── edem-bridge.ts       ← electrobunStage
        │   ├── edem.ts              ← electrobunStage
        │   ├── bun/                 ← electrobunStage
        │   ├── platform/            ← platformStage
        │   ├── composables/         ← dataStage
        │   ├── components/          ← appStage
        │   ├── main.ts, router.ts   ← vueStage
        │   └── ...
        ├── edem-manifests/          ← копия манифестов
        ├── package.json             ← из deps/stages
        └── ...
```

### 3. Рантайм (на машине пользователя)

```
Рантайм
├── edem-manifests/
│   ├── data.json     → загружается раз, определяет валидные коллекции/поля
│   ├── flows.json    → загружается раз, регистрирует триггеры/действия
│   ├── routes.json   → загружается раз, рендерит страницы
│   ├── platform.json → загружается раз, конфигурирует platform-фичи
│   └── assets.json   → загружается раз, определяет ресурсы
└── data.db → SQLite для данных пользователя (items, связи, файлы)
```

## Самореферентная архитектура

Exodus — IDE для построения Edem-приложений. Сам является Edem-приложением:

```
build(exodus) = exodus
```

Exodus хранит свою собственную схему в своей SQLite:

```
SQLite Exodus
├── коллекции
│   ├── projects { name, slug, description, icon, color, type, sort_order }
│   ├── ideas { project_id, title, description, level, type, status }
│   ├── logs { level, message, source, args, count }
│   ├── app_state (singleton) { last_route, locale, theme, window_frame, window_maximized }
│   └── updater_status (singleton) { status, current_version, latest_version, error }
│
└── items
    ├── projects: [...]
    ├── ideas: [...]
    ├── logs: [...]
    └── ...
```

Когда Exodus собирает себя:
1. Читает свои коллекции из SQLite
2. Извлекает data.json, flows.json, routes.json, platform.json, assets.json
3. Codegen генерирует код из манифестов
4. Упаковывает с edem-runtime + Electrobun
5. Результат = тот же Exodus
