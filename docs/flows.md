# Слой логики

Единая модель поведения для Edem. Flow описывает не только domain automation, но и экранное поведение, если оно относится к orchestration-уровню и не требует собственного imperative widget runtime.

← [Edem](./edem.md) · Реализация: [edem-flows](../packages/edem-flows/README.md) · План перехода: [flows-procedure-plan.md](./flows-procedure-plan.md)

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

## Source И Runtime

Flow существует в двух разных формах:

- **Source flow** — проектный артефакт, который редактируется в IDE или хранится в manifest/project data
- **Installed flow** — runtime-артефакт, который уже установлен в приложение и может исполняться движком

Следствия:

- editor не должен считать runtime-коллекцию flow источником истины для authoring
- `edem-flows` является runtime установленной модели, а не primary API редактирования flow
- между authoring и execution должна быть явная граница установки, например через manifest apply/install step
- эмуляция в IDE допустима, но она не должна подменять реальный runtime-контракт

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

## Procedure-backed Nodes

Целевая модель для Edem Flow Runtime:

- любая `query` из любого Edem-модуля автоматически доступна как callable-нода
- любая `mutation` из любого Edem-модуля автоматически доступна как callable-нода
- `action` не является отдельным special-case в целевой модели
- логические helper-ноды, которые не завязаны на topology графа, должны поставляться тем же способом, обычно самим `flows`-модулем

Нода вызова должна ссылаться на модульную процедуру, а не нести отдельную DSL-модель действий.

Пример:

```text
flow node -> module.procedure(input) -> output
```

Разделение ответственности:

- модульная процедура предоставляет только контракт `input -> output`
- конкретный flow задаёт `input/output wiring`, routing, timeout, retry и другие execution policy
- engine отвечает за orchestration, persistence run state, retries, timeouts и обход графа

Это означает, что flow-specific policy не должна экспортироваться модулем как часть логики ноды. Она задаётся только в дизайне конкретного flow.

Категории нод в целевой модели:

- **Boundary / Graph Runtime** — `trigger`, `input`, `output`, `fork`, `join`, `subflow`
- **Procedure-backed Logic** — например `flows.condition`, `flows.switch`, `flows.transform`
- **Procedure-backed Data / UI / Platform / Domain** — любая `query` или `mutation` соответствующего модуля

То есть список callable-нод не должен быть захардкоженным DSL-словарём внутри flow-движка. Он должен строиться из процедур модулей Edem.

Topology-dependent execution primitives не обязаны быть обычными module procedures, если их смысл определяется самим графом, а не только вызовом `input -> output`.

## Node capabilities

Каждая нода должна иметь не только `type`, но и capability metadata:

- в каких `flow profile` она разрешена
- в каких `runtime` она разрешена
- какие scopes использует
- какие side effects производит

Это позволяет валидировать граф до исполнения.

Важно: это статическая metadata уровня типа ноды или runtime-контракта. Она не должна подменять execution policy конкретного node instance. Такие вещи как `timeout`, `retry`, routing и другие flow-instance policy задаются в самом дизайне flow.

## Триггеры

Что инициирует выполнение:

- **UI Event** — `click`, `blur`, `update:model-value`, `keyup.enter` и другие UI-события
- **Event** — системные/data события
- **Schedule** — выполнение по расписанию
- **Manual** — ручной запуск

Целевая модель trigger sources:

- `event` по сути является ссылкой на `subscription` Edem-модуля
- любая `subscription` автоматически доступна как event-trigger source
- `manual` и `schedule` являются встроенными trigger sources того же уровня
- trigger должен быть first-class boundary node графа, а не отдельным параллельным механизмом описания логики

Следствие:

- callable nodes строятся из `query/mutation`
- event triggers строятся из `subscription`
- UI runtime может предоставлять экранные события как subscription-based источники для `ui-action` flow

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
