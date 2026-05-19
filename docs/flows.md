# Слой логики

Единая модель поведения для Edem. Flow описывает не только domain automation, но и экранное поведение, если оно относится к orchestration-уровню и не требует собственного imperative widget runtime.

← [Edem](./edem.md) · Реализация: [edem-flows](../packages/edem-flows/README.md)

## Роль слоя

Flow-слой отвечает за:

- domain behavior
- UI event reactions
- data mutations
- navigation и другие effects
- orchestration между UI, данными и platform/system procedures

Целевая модель экранной логики:

```text
UI event -> ui-action flow -> domain/system calls -> UI effects
```

## Профили flow

Flow не должен быть «любым графом из любых нод». У каждого flow есть профиль, который определяет контракт использования.

Минимальные профили:

- `ui-action` — реакция на UI-события
- `domain` — бизнес-операции и orchestration без UI-specific effects
- `system` — scheduler/platform/background behavior

## Runtime profile

Помимо профиля, flow должен иметь среду исполнения:

- `client`
- `server`
- `either`

Профиль и runtime вместе задают ограничения:

- какие ноды доступны
- какие triggers разрешены
- какие scopes доступны
- какие side effects допустимы

## Boundary nodes

Flow должен иметь явные boundary-точки.

Минимальный набор:

- `trigger`
- `input`
- `output`

Правила зависят от профиля.

Примеры:

- `ui-action`: обязателен `trigger`, обязателен `output`
- `domain`: обязателен `trigger`, `output` желателен
- `system`: обязателен `trigger`, UI-ноды запрещены

## Ноды

Нода — единица вычисления или эффекта.

Категории нод:

- **Logic** — `condition`, `switch`, `loop`, `delay`
- **Data** — `input`, `output`, `data:create-item`, `data:update-item`, `data:delete-item`, `data:update-singleton`
- **Transform** — `transform`
- **UI Effects** — `ui:set-state`, `ui:set-timeout-state`, `ui:navigate`, `ui:clipboard-write`, `ui:event`
- **External / Domain** — `action`, `domain:invoke`, `subflow`
- **Flow** — `fork`, `join`

## Node capabilities

Каждая нода должна иметь не только `type`, но и capability metadata:

- в каких `flow profile` она разрешена
- в каких `runtime` она разрешена
- какие scopes использует
- какие side effects производит

Это позволяет валидировать граф до исполнения.

## Триггеры

Что инициирует выполнение:

- **UI Event** — `click`, `blur`, `update:model-value`, `keyup.enter` и другие UI-события
- **Event** — системные/data события
- **Schedule** — выполнение по расписанию
- **Manual** — ручной запуск
- **Webhook** — HTTP callback

Не все trigger types разрешены для всех профилей.

Примеры:

- `ui-action` использует UI event или ручной запуск из screen runtime
- `domain` обычно использует `manual`, `event` или вызов из другого flow
- `system` использует `schedule`, `event`

## Контекст выполнения

Flow работает не с глобической магией, а с явными scope.

Базовые scope:

- `trigger.*` — входные данные запуска
- `nodes.*` — outputs уже выполненных нод
- `context.*` — переменные flow

Дополнительные UI scope для `ui-action`:

- `trigger.event`
- `trigger.item`
- `trigger.route`
- `trigger.props`
- `context.state`
- `context.queries`
- `context.helpers`

## Шаблонные выражения

`{{ scope.path }}` используются для доступа к данным в контексте выполнения.

Flow-выражения должны использоваться для:

- guard conditions
- input/output wiring
- payload mapping
- effect parameters

Они не должны подменять собой произвольный imperative runtime.

## State machine выполнения

```text
pending -> running -> waiting -> completed
                       ↓
                     error | cancelled
```

Terminal-состояния:

- `completed`
- `error`
- `cancelled`

## Async Nodes

Нода может приостановить выполнение и возобновиться позже. Это нужно для:

- внешних вызовов
- user-driven resume
- длинных integration tasks
- timers и delayed effects

Если async node встречается внутри `subflow`, состояние ожидания должно корректно пропагироваться вверх.

## Adaptive Execution

Для некоторых нод execution может быть adaptive:

- если обработчик доступен, нода исполняется сразу
- если обработчика нет, run переходит в `waiting`

Это полезно для интеграций и boundary между flow runtime и внешней средой.

## Fork/Join

Поддерживается разветвление графа на параллельные ветки с последующей агрегацией:

- `all`
- `any`
- `n_of_m`

Если ветка содержит async node, выполнение может перейти в `waiting` до завершения нужных веток.

## Retries, Timeouts, Backpressure

- **Retries** — автоматические повторные попытки с backoff
- **Timeouts** — ограничение времени на ноду
- **Backpressure** — лимиты на параллельные и ожидающие run'ы

Эти механизмы особенно важны для `domain` и `system` flow. Для `ui-action` они должны использоваться осторожно и только там, где не ломают UX.

## Dispatcher

Dispatcher отвечает за маршрутизацию событий в подходящие flow:

- data/system events -> `domain` / `system`
- UI events -> `ui-action`

Для UI flow dispatcher может быть частью screen runtime, а не только отдельного серверного процесса.

## Scheduler

Scheduler запускает flow по интервалу или расписанию. Это профиль `system`, а не `ui-action`.

## Что хорошо ложится в flow

По реальным экранам `Exodus` через flow должны описываться:

- create -> navigate
- inline field update с guard'ами
- delete confirm
- clipboard + transient feedback
- modal open/close
- stopPropagation / preventDefault + business action

## Что не должно выражаться через базовый flow DSL

- внутренности graph editor
- canvas и pointer runtime
- сложные drag/drop systems
- специализированные imperative widgets

Для таких случаев flow оркестрирует boundary-события, а сама сложность живёт во внешнем компоненте.

## Ключевое свойство

Flow-слой — это единый язык поведения для Edem. Разные классы сценариев используют один execution model, но с разными profile contracts. Универсальность обеспечивается на уровне движка, а ограничения — на уровне профиля.
