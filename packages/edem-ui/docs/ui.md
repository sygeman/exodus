# UI Layer

## Overview

Presentation layer. Displays data and handles user interaction.

UI = компоненты. Как в flows: нода = базовый элемент, так и в UI: компонент = базовый элемент.

Reference: **Storybook** (component-driven development)

## Архитектура

```
routes.json (дерево компонентов)
        ↓
    Рендерер (Vue)
        ↓
    Модуль (реестр компонентов)
        ↓
    DOM
```

**Нет фиксированного набора примитивов.** Всё определяется модулем.

## Контракт

Компонент в JSON описывается через:

```typescript
type ComponentNode = {
  component: string              // имя компонента (из реестра модуля)
  props?: Record<string, any>    // пропсы компонента
  children?: ComponentNode[]     // вложенные компоненты
  events?: Record<string, EventBinding>  // обработчики событий
  bind?: DataBinding             // биндинг к данным
}
```

### События (events)

События компонента привязываются к действиям:

```typescript
type EventBinding =
  | { flow: string; input?: Record<string, unknown> }  // вызвать flow
  | { action: string; collection?: string; data?: Record<string, unknown> }  // CRUD
  | { navigate: string }  // навигация
```

### Биндинги (bind)

Данные резолвятся из контекста:

```typescript
type DataBinding = {
  collection?: string     // источник данных
  filter?: FilterQuery    // фильтр
  sort?: string[]         // сортировка
  item?: ComponentNode    // шаблон элемента (для списков)
}
```

Шаблоны: `{{ item.title }}`, `{{ item.name }}`, `{{ context.userId }}`

## Модуль

Модуль — реестр компонентов. Определяет какие компоненты доступны.

```typescript
type UIModule = {
  name: string
  components: Record<string, VueComponent>  // name → implementation
}
```

Пример: Vue/NuxtUI модуль регистрирует:
- `UButton`, `UInput`, `UTextarea`, `USelect`, `USelectMenu`
- `USwitch`, `UBadge`, `UIcon`, `UCard`
- `UScrollArea`, `USkeleton`, `UModal`, `UTooltip`

Другой модуль может зарегистрировать свои компоненты.

## JSON формат

### Простой компонент

```json
{
  "component": "UButton",
  "props": {
    "label": "Create",
    "color": "primary",
    "variant": "soft"
  },
  "events": {
    "click": { "flow": "createProject" }
  }
}
```

### Компонент с биндингом

```json
{
  "component": "UInput",
  "props": {
    "placeholder": "Enter title..."
  },
  "bind": {
    "collection": "projects",
    "filter": { "id": { "_eq": "{{ context.projectId }}" } }
  }
}
```

### Список элементов

```json
{
  "component": "UCard",
  "bind": {
    "collection": "games",
    "filter": { "status": { "_eq": "playing" } },
    "sort": ["-created_at"],
    "item": {
      "component": "UButton",
      "props": {
        "label": "{{ item.name }}",
        "variant": "ghost"
      },
      "events": {
        "click": { "navigate": "/games/{{ item.id }}" }
      }
    }
  }
}
```

### Страница целиком

```json
{
  "component": "UCard",
  "props": { "class": "p-4" },
  "children": [
    {
      "component": "UButton",
      "props": { "label": "Create game", "color": "primary" },
      "events": {
        "click": { "flow": "createGame" }
      }
    },
    {
      "component": "UScrollArea",
      "children": [
        {
          "component": "UBadge",
          "props": { "label": "{{ item.name }}" },
          "bind": {
            "collection": "games",
            "sort": ["-created_at"]
          }
        }
      ]
    }
  ]
}
```

### Модалка подтверждения

```json
{
  "component": "UModal",
  "props": { "title": "Delete project?" },
  "children": [
    {
      "component": "UButton",
      "props": { "label": "Cancel", "variant": "ghost" }
    },
    {
      "component": "UButton",
      "props": { "label": "Delete", "color": "error" },
      "events": {
        "click": { "flow": "deleteProject", "input": { "projectId": "{{ context.projectId }}" } }
      }
    }
  ]
}
```

## Рендерер

Рендерер (Vue) делает:

1. **Читает JSON** — дерево компонентов
2. **Резолвит bindings** — `{{ item.title }}` → реальное значение из контекста
3. **Маппит компоненты** — имя → Vue компонент через модуль
4. **Рендерит** — рекурсивно рендерит дерево
5. **Подписывается** — на изменения данных (edem.data subscriptions)

### Контекст рендеринга

```typescript
type RenderContext = {
  item?: Record<string, unknown>       // текущий элемент (для списков)
  collection?: string                   // текущая коллекция
  userId?: string                       // текущий пользователь
  projectId?: string                    // текущий проект
  [key: string]: unknown               // расширяемый
}
```

## Примеры из Exodus

### Список проектов (ProjectsListPage)

```json
{
  "component": "UCard",
  "children": [
    {
      "component": "UButton",
      "props": { "label": "Create project", "color": "primary" },
      "events": { "click": { "flow": "createProject" } }
    },
    {
      "component": "UScrollArea",
      "bind": {
        "collection": "projects",
        "sort": ["sort_order"],
        "item": {
          "component": "ULink",
          "props": { "to": "/project/{{ item.id }}/overview" },
          "children": [
            { "component": "UBadge", "props": { "label": "{{ item.name }}" } }
          ]
        }
      }
    }
  ]
}
```

### Редактор идеи (IdeaPage)

```json
{
  "component": "UCard",
  "bind": {
    "collection": "ideas",
    "filter": { "id": { "_eq": "{{ context.ideaId }}" } }
  },
  "children": [
    {
      "component": "UInput",
      "props": { "modelValue": "{{ item.title }}" },
      "events": { "update:modelValue": { "action": "updateItem", "data": { "title": "{{ event }}" } } }
    },
    {
      "component": "UTextarea",
      "props": { "modelValue": "{{ item.description }}", "rows": 6 },
      "events": { "update:modelValue": { "action": "updateItem", "data": { "description": "{{ event }}" } } }
    },
    {
      "component": "USelect",
      "props": {
        "modelValue": "{{ item.level }}",
        "items": ["L0", "L1", "L2", "L3", "L4"]
      },
      "events": { "update:modelValue": { "action": "updateItem", "data": { "level": "{{ event }}" } } }
    }
  ]
}
```

### Логи (DebugLogs)

```json
{
  "component": "UCard",
  "children": [
    {
      "component": "USelectMenu",
      "props": { "placeholder": "Filter by level..." },
      "bind": {
        "collection": "logs",
        "filter": { "level": { "_eq": "{{ context.levelFilter }}" } },
        "sort": ["-created_at"],
        "item": {
          "component": "UBadge",
          "props": { "label": "{{ item.level }}", "color": "{{ item.level }}" }
        }
      }
    }
  ]
}
```
