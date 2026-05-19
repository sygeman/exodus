# UI-слой

Декларативная модель структуры экрана. UI-манифест описывает, что рендерить, а поведение экрана описывается отдельно через flow.

← [Edem](./edem.md) · Реализация: [edem-ui](../packages/edem-ui/README.md)

## Роль слоя

UI-слой отвечает за orchestration-уровень экрана:

- component tree
- props
- children и slots
- conditions и loops
- route/layout composition
- query declarations
- local state declarations
- event -> flow binding
- wrapper metadata для внешних компонентов

UI-слой не является местом для экранной бизнес-логики.

## Базовый принцип

Экран описывается как:

```text
ui manifest + flow manifest + runtime
```

Не как:

```text
ui manifest -> generated .vue page
```

Для manifest-driven экранов dedicated `.vue`-страница не является целевым артефактом.

## Компонентный узел

Описывает один элемент UI:

- **Компонент** — HTML-тег или зарегистрированный внешний компонент
- **Свойства** — параметры компонента
- **Дочерние** — вложенные узлы, текст, перевод, slot content
- **События** — привязки `event -> flow`
- **Привязки** — queries, iteration, aliases, conditional rendering

## Философия

Edem UI не пытается стать новым UI-фреймворком. Его задача — выразить универсальные концепции современного интерфейса:

- композицию компонентов
- props, slots, children
- структуру экранов и layouts
- привязки к данным
- локальные UI state surfaces
- события как точки входа в flow runtime

Сложное поведение не описывается внутри UI DSL повторно. Если нужен нетривиальный runtime, он выносится во внешний пакет.

## Внешние компоненты

UI-манифест должен уметь ссылаться на:

- встроенные HTML-элементы
- локально зарегистрированные компоненты
- внешние компоненты из npm-пакетов
- внутренние пакеты монорепы

Для внешнего компонента Edem управляет только orchestration-слоем:

- регистрация
- передача props
- model bindings
- slots и children
- маппинг component events на flow

Внутреннее imperative-поведение компонента остаётся внутри пакета.

## Привязки событий

Целевая модель событий одна:

- **Flow** — запуск flow по событию UI

Пример:

```json
{
  "flows": {
    "create": {
      "profile": "ui-action"
    }
  },
  "events": {
    "click": {
      "flow": "create"
    }
  }
}
```

`event -> action` и component-local actions допустимы только как переходный слой во время миграции, но не как целевой контракт.

## Screen-Local Logic

Screen-local orchestration должна жить рядом со структурой экрана, а не в отдельном sidecar-файле.

Практически это означает:

- screen-specific `ui-action` flow объявляются в том же `ui manifest`
- `events` внутри дерева ссылаются на локальные имена flow этого экрана
- reusable `domain` и `system` flow остаются внешними first-class сущностями

Пример:

```json
{
  "flows": {
    "confirmDelete": {
      "profile": "ui-action",
      "nodes": [
        { "id": "trigger", "type": "trigger" },
        { "id": "delete", "type": "data:delete-item" }
      ]
    }
  },
  "children": [
    {
      "component": "UButton",
      "events": {
        "click": { "flow": "confirmDelete" }
      }
    }
  ]
}
```

Так становится явно видно, что это именно логика экрана, а не общий внешний flow registry.

## Привязки данных

UI-модель должна покрывать базовые query-паттерны:

- коллекции
- singleton-данные
- route-derived bindings
- filters и sort
- iteration по items
- item alias
- model bindings

UI только объявляет, какие данные нужны экрану. Решение, что делать с этими данными при событии, живёт во flow.

## Условная отрисовка

Поддерживаются:

- `if`
- `elseIf`
- `else`

Это структурная часть UI-дерева, а не место для императивной логики.

## Структурные элементы

- links
- modals
- teleport
- transitions
- named slots
- skeleton
- empty state

Эти элементы должны описываться декларативно и исполняться screen runtime.

## Шаблонные выражения

`{{ expr }}` разрешаются в свойствах и тексте.

Типичный контекст выражений:

- `route`
- `queries`
- `state`
- `helpers`
- `t`
- текущий `item` внутри итерации

UI-выражения нужны для чтения и связывания данных. Побочные эффекты и mutation-логика не должны жить внутри выражений.

## Состояние

UI-манифест может объявлять:

- локальные значения
- вычисляемые значения
- query-derived значения

Но изменение этого состояния должно происходить через flow runtime, а не через component-local imperative handlers.

То есть UI объявляет surface состояния, а flow управляет переходами.

## Layout и shell

UI-модель должна покрывать:

- route shells
- nested layouts
- sidebar/topbar composition
- named content areas

Layout остаётся частью UI DSL. Его поведение по событиям также должно уходить в flow.

## Screen Runtime

Конкретный рендерер должен уметь:

- читать `ui manifest`
- поднимать queries
- создавать local state
- вычислять derived values
- строить handlers для `event -> flow`
- рендерить component tree через registry

Один manifest должен уметь исполняться без dedicated page-SFC.

## Ограничения

Edem UI намеренно не решает задачи уровня specialized widget engines. Вне зоны ответственности базового UI DSL:

- внутренности graph editor
- низкоуровневая canvas-логика
- сложные drag/drop и pointer systems
- богатые imperative editors
- proprietary runtime конкретного сложного компонента

Такие вещи подключаются как внешние black-box компоненты.

## Ключевое свойство

Модель не привязана к конкретному UI-фреймворку. Один и тот же UI manifest должен описывать структуру экрана независимо от того, какой runtime и renderer используются под капотом.
