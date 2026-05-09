# Codegen: что доделать

## Текущее состояние

Базовый пайплайн работает:
- `ui.json` (routes) + `components/*.json` → IR → Vue компоненты
- Nested routes генерируются
- Conditional rendering (`v-if`/`v-else-if`/`v-else`)
- Skeleton/empty states
- Template expressions резолвятся
- Handlers (flow triggers, navigate, actions)
- Manifests копируются как есть в `edem-manifests/`

## Баги генерации

### 1. Двойной RouterLink

**Файл:** `ProjectsListPage.vue` строка 37-38

```html
<RouterLink v-for="item in projects" :key="item.id">
  <RouterLink :to="/project/${item.id}/overview" ...>
```

**Причина:** В `ProjectsListPage.json` `bind.item` содержит `component: "RouterLink"`, а внешний контейнер тоже оборачивается в RouterLink из-за `bind.collection`.

**Исправление:** В `app.ts` `renderNode` — не оборачивать в RouterLink если `bind.item` уже является RouterLink.

### 2. Style binding не резолвится

**Файл:** `ProjectsListPage.vue` строка 39

```html
:style="{ color: item.color }}; border-color: {{ item.color }}"
```

**Причина:** `renderProps` обрабатывает `style` как объект, но формат `{{ item.color }}; border-color: {{ item.color }}` не парсится.

**Исправление:** В `renderProps` добавить обработку составных style строк через `resolveVueTemplateString`.

### 3. Отсутствующие переменные в script

**Файлы:** `ProjectsListPage.vue`, `IdeaPage.vue`, `ProjectLayout.vue`, `DebugLogs.vue`

Проблемные переменные:
- `showSkeleton` — не генерируется `ref(false)` + `watch(loading, ...)`
- `project` — не генерируется `computed(() => projects.value.find(...))`
- `idea` — не генерируется `computed(() => ideas.value.find(...))`
- `projectId` — не генерируется `computed(() => route.params.id)`
- `levelFilter`, `sourceFilter`, `textFilter`, `levelOptions`, `sourceOptions`, `stats`, `total`, `formatTime` — не генерируются из composable

**Исправление:** В `renderScript` добавить генерацию:
- `ref()` для `showSkeleton`
- `computed()` для `item`, `project`, `idea`, `projectId`
- Деструктуризацию из composable для всех нужных переменных

### 4. `useIdeas` не импортируется

**Файл:** `IdeaPage.vue`

`useIdeas` не импортируется хотя используется `idea`, `loading`, `removeIdeas`, `updateIdeas`.

**Причина:** `IdeaPage.json` не имеет `bind.collection` на корневом уровне — `bind` есть только на дочерних элементах. Кодоген не видит связь с collection `ideas`.

**Исправление:** В `parse.ts` `extractUsedCollections` — обходить `if`/`elseIf`/`else` деревья.

### 5. `edem` не импортируется в некоторых компонентах

**Файл:** `IdeaPage.vue`

`edem` не импортируется хотя есть handlers с flow triggers.

**Причина:** `extractNeedsEdem` не обходит `if`/`elseIf`/`else` деревья.

**Исправление:** В `parse.ts` `extractNeedsEdem` — рекурсивно обходить условные ветки.

### 6. `renderProps` не резолвит `{{ }}` в строковых значениях

**Файл:** `AppSidebar.vue`

`[&&>*>]` вместо `[&&>*]` — HTML escaping ломает CSS селектор.

**Причина:** `escapeAttr` экранирует `>` в `>`.

**Исправление:** Не экранировать `>` в class/style атрибутах, или использовать другой подход.

### 7. Navigate handler с `back`/`forward`

**Файл:** `AppTopMenu.vue`

```json
"events": { "click": { "navigate": "back" } }
```

Генерирует `router.push("back")` вместо `router.back()`.

**Исправление:** В `collectHandlerCode` добавить обработку `"back"` и `"forward"` как особых случаёв.

### 8. Условные переменные в template

**Файл:** `IdeaPage.vue` строка 29

```html
<UButton :to="/project/${projectId}/ideas" variant="link">
```

`:to` не в кавычках — синтаксическая ошибка Vue.

**Исправление:** В `renderProps` оборачивать `:attr` значения в кавычки если содержат `${`.

### 9. `collectFunctionCalls` не обходит `if`/`elseIf`/`else`

**Причина:** Если вызов функции находится внутри условной ветки, он не会被 обнаружен.

**Исправление:** Добавить обход условных деревьев в `collectFunctionCalls`.

### 10. `buildFilterParam` не находит collection для filtered items

**Файл:** `IdeaPage.vue`

`useIdeas` не получает filter param потому что `ideaId` не маппится на collection field.

**Исправление:** В `buildFilterParam` добавить mapping для `ideaId` → `ideas.id`.

## Архитектурные улучшения

### 11. Поддержка `computed` imports

Когда компонент использует `computed()`, нужно автоматически добавлять `import { computed } from "vue"`.

### 12. Поддержка `ref` imports

Когда компонент использует `ref()` (для модалок, loading states), нужно добавлять `import { ref } from "vue"`.

### 13. Поддержка `onMounted`/`onUnmounted`

Для composable subscriptions нужен lifecycle: `onMounted(() => { load(); subscribe() })` + `onUnmounted()`.

### 14. Поддержка `watch`

Для reactive filter changes нужен `watch()`.

## Приоритет

1. **Критичные** — ломают компиляцию: #1, #2, #4, #5, #7, #8
2. **Важные** — ломают runtime: #3, #6, #10
3. **Улучшения** — #9, #11, #12, #13, #14
