# Edem Codegen

Build-time code generator для Edem — трансформация JSON-манифестов в готовый код приложения.

## Обзор

Пакет читает декларативные манифесты (data, routes, components, flows, platform), парсит их в framework-agnostic IR (Intermediate Representation), валидирует перекрёстные ссылки и генерирует готовые файлы через pipeline stages.

```
Манифесты → loadManifests → parseManifests → IR → validateIR → Stages → Файлы
```

## Установка

```typescript
import { createEdem } from "@exodus/edem-core"
import { codegenModule, loadManifests } from "@exodus/edem-codegen"

const manifests = loadManifests("/path/to/manifests")
const edem = createEdem([codegenModule])

const result = await edem.codegen.generateProject({
  project_id: "my-app",
  output: "/path/to/output",
  manifests,
  project_name: "My App",
})
```

## API

### `codegenModule`

Edem-модуль с одной мутацией:

#### `generateProject`

```typescript
const { files, output } = await edem.codegen.generateProject({
  project_id: string        // идентификатор проекта
  output: string            // выходная директория
  manifests: Manifests      // загруженные манифесты
  project_name?: string     // имя проекта
  manifests_dir?: string    // исходная директория для ресурсов
})
```

### `loadManifests(dir)`

Читает JSON-манифесты из директории и возвращает `Manifests`:

```typescript
import { loadManifests } from "@exodus/edem-codegen"

const manifests = loadManifests("/path/to/manifests")
// manifests = { routes, components, data, flows, assets?, platform? }
```

Ожидаемые файлы:
- `routes.json` — маршруты
- `components/*.json` — компоненты (по одному на файл)
- `data.json` — коллекции и поля
- `flows.json` — потоки и триггеры
- `platform.json` — platform config (опционально)
- `assets.json` — ресурсы (опционально)

### `parseManifests(manifests, projectName?)`

Конвертирует `Manifests` в типизированный `IR`:

```typescript
import { parseManifests } from "@exodus/edem-codegen"

const ir = parseManifests(manifests, "My App")
```

### `validateIR(ir)`

Возвращает массив `ValidationError[]`:

```typescript
import { validateIR } from "@exodus/edem-codegen"

const errors = validateIR(ir)
// errors: Array<{ type: "error" | "warning", message: string, path: string }>
```

Проверяет: маршруты ссылаются на существующие компоненты, компоненты — на коллекции и потоки, типы полей корректны, рёбра потоков — на существующие ноды, шаблонные поля существуют в коллекциях.

## Stages

Pipeline состоит из stages, каждый генерирует подмножество файлов:

| Stage | Генерирует |
|-------|-----------|
| `bunStage` | `bunfig.toml` |
| `electrobunStage` | Electrobun platform files: config, bun entry, bridge, typed proxy, scripts |
| `vueStage` | Vue app: `App.vue`, `main.ts`, `router.ts`, `app.css`, `vite.config.ts`, `index.html`, `tsconfig.json` |
| `dataStage` | `manifest.ts`, composable-хи для каждой коллекции (`use{Collection}.ts`) |
| `flowsStage` | `flows-manifest.ts`, `flows-bootstrap.ts` |
| `appStage` | `.vue` компоненты из JSON-деревьев, `registry.ts`, `.gitignore` |
| `platformStage` | `logger.ts`, `app-state.ts` (persistence, system detection) |

## Типы

### `IR`

```typescript
type IR = {
  project: IRProject
  components: IRComponent[]
  routes: IRRoute[]
  collections: IRCollection[]
  flows: IRFlow[]
  assets?: unknown
  layout?: IRLayoutInfo
  platform?: IRPlatformConfig
  usedComponents: string[]
}
```

### `Manifests`

```typescript
type Manifests = {
  routes: unknown
  components: unknown[]
  data: unknown
  flows: unknown
  assets?: unknown
  platform?: unknown
}
```

### `OutputFile`

```typescript
type OutputFile = {
  path: string
  content: string
}
```

## Утилиты

| Функция | Описание |
|---------|----------|
| `walkComponentTree(node, visitor)` | Рекурсивный обход JSON-дерева компонентов |
| `collectFromTree(node, collector)` | Сбор уникальных значений из дерева |
| `someInTree(node, predicate)` | Проверка условия в дереве |
| `buildParamMap(ctx)` | Маппинг `context.xxx` → `route.params.xxx` |
| `findRouteForComponent(ir, name)` | Поиск маршрута по имени компонента |
| `capitalize(str)` | Капитализация первой буквы |
| `kebabCase(str)` | PascalCase → kebab-case |
| `camelCase(str)` | kebab-case → camelCase |
| `slugify(str)` | Безопасный slug из строки |
| `escapeAttr(str)` | Экранирование `"` и `<` для HTML |

## CLI

Пакет предоставляет бинарник `exodus-gen`:

```bash
exodus-gen
```

Загружает mock-манифесты из `src/__mocks__/` и генерирует проект в `apps/exodus-generated`.
