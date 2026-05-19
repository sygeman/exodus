# План Self-Hosting UI

Рабочий план перевода `Exodus` к честной self-hosting модели, где экран описывается через `ui manifest`, поведение описывается через `flow manifest`, а runtime собирает экран без generated `.vue`-страниц.

← [Edem](./edem.md) · [UI-слой](./ui.md) · [Codegen](./codegen.md)

## Цель

Целевое состояние:

- `Exodus` не использует hand-written или generated `.vue`-экраны как основную форму описания UI
- экран описывается через `ui manifest`
- логика экрана описывается через `flow manifest`
- сложные интерактивные системы подключаются как внешние npm/internal packages
- runtime умеет собрать экран напрямую из манифестов

Self-hosting в этом документе означает не `manifest -> codegen -> Vue SFC`, а:

```text
ui manifest + flow manifest + component registry + runtime -> экран приложения
```

## Не-цели

- не превращать Edem в ещё один UI-фреймворк общего назначения
- не выражать через базовый DSL внутренности graph editor, canvas-виджетов и других imperative систем
- не считать generated `.vue`-страницы целевым результатом
- не подменять архитектуру красивым parity-отчётом

## Архитектурная рамка

Граница ответственности должна быть жёсткой.

### UI manifest отвечает за

- component tree
- props
- children и slots
- conditions и loops
- route/layout composition
- query declarations
- local state declarations
- event -> flow binding
- wrapper metadata для внешних компонентов

### Flow manifest отвечает за

- обработку UI-событий
- guard-логику
- CRUD и domain-вызовы
- navigation
- local UI effects
- orchestration между UI и domain/system flow

### External packages отвечают за

- graph editors
- canvas/runtime-heavy widgets
- drag/drop и gesture systems
- сложные imperative viewers/editors
- любой специализированный UI со своей внутренней state machine

### Runtime отвечает за

- разрешение manifests
- подъем queries/state/computed
- routing/layout composition
- event -> flow execution
- применение UI effects
- интеграцию external component registry

## Ключевой вывод

Текущий план self-hosting нельзя дальше вести как codegen-first проект генерации `.vue`-экранов. Генерация может оставаться вспомогательным инструментом, но целевая архитектура должна быть runtime-first.

Из этого следует:

- generated `.vue`-pages больше не являются целевым артефактом
- `actions` как отдельный component-local mini-runtime не являются целевой моделью
- `event -> action` не является целевой связью
- целевая связь: `event -> flow`

## Что остаётся актуальным из старого плана

- необходимость честкого runtime-контракта
- first-class schema для state, queries, layouts и wrappers
- capability inventory по реальным экранам `Exodus`
- boundary между native orchestration и external widgets
- отказ от copy-from-reference как архитектурного решения
- сильный `IR` и `validate`
- проверка прогресса на реальных product slice, а не только на инфраструктуре

## Что больше не является целевым направлением

- наращивание генерации `.vue`-экранов и template handlers
- достижение page parity как самостоятельная цель
- shell/layout/page diff как основной KPI self-hosting
- логика экрана, размазанная между `actions`, generated handlers и reference-компонентами

## Текущий baseline

На сегодня в репозитории уже есть полезные строительные блоки, которые можно переиспользовать:

- манифесты находятся в `apps/exodus/edem-manifests`
- runtime data/flows hooks уже существуют
- `edem-ui` уже умеет runtime-рендеринг component tree
- `edem-flows` уже умеет исполнение flow как отдельный движок
- `apps/exodus` можно использовать как полигон для runtime-first прототипа
- `compare.ts` и `apps/exodus-generated` можно использовать как миграционный инструмент, но не как целевую форму системы

Отдельно важно:

- `rawScript` больше не должен фигурировать как текущий escape hatch в этом плане
- если старые упоминания `rawScript` или generated-only glue остались в других документах, их нужно считать историческим контекстом, а не действующей нормой

## Основные проблемы текущего состояния

1. Архитектура всё ещё частично мыслится через generated `.vue`-страницы, хотя целевая модель должна быть runtime-first.
2. UI-логика сейчас размазана между `events`, `actions`, generated handlers и reference-компонентами.
3. В `Exodus` уже видны повторяющиеся UI-сценарии, которые хорошо ложатся в flow, но пока не имеют общего runtime-контракта.
4. Сложные widgets пока не оформлены как систематический wrapper boundary.
5. `compare.ts` и `apps/exodus-generated` полезны для перехода, но начинают искажать приоритеты, если рассматривать их как основной KPI.

## Красные линии

- не считать generated `.vue`-экран конечной целью
- не вводить новую экранную логику через framework-specific слой, если её можно выразить через manifest + flow
- не тащить внутренности complex widget в базовый DSL
- не улучшать parity ценой размытия runtime-контракта
- не считать экран self-hosted, если его поведение всё ещё зависит от hidden imperative glue вне формального runtime

## Runtime-first целевая архитектура

Нужны четыре связных слоя.

### 1. Screen Runtime

Единый runtime экрана, который:

- принимает `ui manifest`
- поднимает `queries`
- создаёт local `state`
- вычисляет `computed`
- собирает `handlers`
- рендерит дерево через component registry

Экран должен собираться без dedicated `.vue`-страницы.

### 2. Logic Flow Runtime

UI-ориентированный runtime логики, который:

- принимает flow definitions
- исполняет `ui-action` flow
- умеет работать с контекстом экрана
- вызывает data/domain/system APIs
- возвращает output и применяет UI effects

Минимальные входные scope для UI-flow:

- `trigger.event`
- `trigger.item`
- `trigger.route`
- `trigger.props`
- `context.state`
- `context.queries`
- `context.helpers`

### 3. Wrapper Registry

Контракт внешних компонентов должен описывать:

- import source
- export name
- публичное registry name
- props contract
- events contract
- model bindings
- slots
- optional renderer metadata

### 4. Domain/System Flow Boundary

UI-flow не должен нести всё на себе.

Нужны как минимум три класса flow:

- `ui-action`
- `domain`
- `system`

Типичный паттерн:

```text
UI event -> ui-action flow -> domain flow/procedure -> UI effect
```

## Что реально должно выражаться через flow

По текущим экранам `Exodus` в flow-модель хорошо ложатся:

- create -> navigate
- inline field update с guard'ами
- confirm delete
- clipboard + transient feedback
- stopPropagation / preventDefault + business action
- local modal state
- route-aware navigation

Типичные экраны-кандидаты:

- `ProjectsListPage`
- `ProjectIdeasPage`
- `ProjectFlowsPage`
- `SettingsAppearance`
- `SettingsLanguage`
- `ProjectSettingsPage`
- `FlowCodePage`
- большая часть `IdeaPage`

## Что не должно выражаться через базовый flow DSL

- внутренности `FlowEditor`
- canvas/drag/drop runtime
- сложная pointer-логика
- node/edge editor internals
- большие imperative debug/viewer widgets

Такие вещи должны приходить как external component wrappers.

## Capability inventory

Следующий полезный артефакт не parity-таблица, а capability inventory по реальным экранам.

Нужно собрать матрицу по категориям:

- view composition
- route/layout composition
- queries и singleton bindings
- local state
- computed values
- UI actions
- domain actions
- UI effects
- external widget wrappers

Результат inventory должен отвечать на три вопроса:

1. что покрывается runtime-native моделью
2. что должно быть flow-native
3. что должно жить только как external component

## Целевая схема UI-контракта

UI manifest должен упроститься до следующей логики:

- UI описывает структуру
- event binding указывает на `flow`
- локальный state объявляется, но не исполняется вручную в component-local actions

Целевая event-модель:

```json
{
  "events": {
    "click": {
      "flow": "projects.create"
    }
  }
}
```

`actions` как отдельная DSL-модель не являются целевым интерфейсом и должны рассматриваться как переходный слой.

## Целевая схема flow-контракта

Для UI-нужд достаточно начать с профилированных flow.

Минимальные виды:

- `ui-action`
- `domain`
- `system`

Минимальные UI-ноды первой версии:

- `guard`
- `ui:set-state`
- `ui:set-timeout-state`
- `ui:navigate`
- `ui:clipboard-write`
- `ui:event`
- `data:create-item`
- `data:update-item`
- `data:delete-item`
- `data:update-singleton`
- `domain:invoke`
- `output`

## Роль codegen после смены курса

Codegen не обязательно исчезает, но его роль меняется.

Он остаётся полезен для:

- сборки manifest bundles
- type artifacts
- registry metadata
- route tables
- platform glue
- validation pipeline
- migration tooling

Он не должен оставаться основной машиной производства экранных `.vue`-страниц.

## Роль compare.ts и apps/exodus-generated

Эти инструменты всё ещё полезны, но их статус теперь вспомогательный.

Они нужны для:

- миграционного контроля
- фиксации coverage уже перенесённых экранов
- поиска runtime/schema gap на переходном этапе

Они не должны задавать целевую архитектуру.

Практическое следствие:

- parity допустимо использовать как сигнал
- parity нельзя использовать как главный критерий архитектурной готовности

## План внедрения

### Этап 0. Актуализация направления

1. Зафиксировать runtime-first модель как целевую.
2. Обновить документы так, чтобы generated `.vue`-pages больше не описывались как целевой output.
3. Сохранить `apps/exodus-generated` и `compare.ts` только как migration tooling.

Definition of done:

- целевая архитектура описана как `manifest + runtime`, а не как `manifest -> SFC`
- документация не предполагает `.vue`-экраны как основную форму self-hosting

### Этап 1. Capability Inventory

1. Пройтись по реальным экранам `Exodus`.
2. Собрать матрицу сценариев `native UI / ui-flow / external component`.
3. Выбрать первый runtime-first vertical slice.

Definition of done:

- есть capability matrix
- выбран стартовый экран и следующий экран после него
- для спорных сценариев принята граница `runtime-native` vs `external`

### Этап 2. UI Runtime Prototype в apps/exodus

1. Сделать первый `ScreenRuntime` прямо в `apps/exodus`.
2. Использовать существующие hooks и renderer там, где это возможно.
3. Проверить, что экран можно собрать без dedicated `.vue`-страницы.

Definition of done:

- есть рабочий runtime prototype
- он поднимает state, queries и handlers из manifests
- он не требует generated page component для первого slice

### Этап 3. Logic Flow Runtime Prototype

1. Сделать `useLogicFlow` или эквивалентный UI runtime adapter.
2. Реализовать минимальный набор `ui-action` node types.
3. Проверить контекст `event/item/route/state/queries` на реальном экране.

Definition of done:

- UI-логика первого slice исполняется единым flow runtime
- component-local action runtime больше не нужен для этого slice

### Этап 4. Wrapper Model

1. Формализовать metadata внешних компонентов.
2. Подключить 1-2 реальных widgets через wrapper contract.
3. Зафиксировать boundary, который не пускает internal imperative logic в базовый DSL.

Definition of done:

- wrapper contract покрывает реальный компонент
- сложный widget используется как black-box без попытки описать его внутренности в flow/UI DSL

### Этап 5. Flow Profile System

1. Ввести `ui-action`, `domain`, `system` как first-class профили.
2. Ограничить доступные ноды и runtime scope по профилю.
3. Научить validation проверять эти ограничения.

Definition of done:

- flow type влияет на реальный контракт
- UI-нод нельзя использовать в `domain/system` flow

### Этап 6. Schema и IR Cleanup

1. Упростить UI event contract до `event -> flow`.
2. Перевести `actions` в переходный слой или убрать их из целевого контракта.
3. Протянуть новые сущности через schema, IR и validate.

Definition of done:

- UI schema соответствует runtime-first модели
- документация и типы не расходятся с фактическим runtime

### Этап 7. Migration

Переносить экраны короткими циклами:

1. выбрать экран
2. описать его `ui manifest`
3. описать его `flow manifest`
4. подключить нужные wrappers
5. собрать экран runtime-способом
6. только потом обобщать решение

Definition of done:

- каждый перенесённый экран живёт без dedicated `.vue`-страницы
- сложные части остаются wrapper-based
- runtime contract не размывается между экранами

## Первый vertical slice

Рекомендуемый порядок:

1. `FlowCodePage`
2. `ProjectsListPage`
3. `IdeaPage`

Причина:

- `FlowCodePage` проверяет guard, clipboard, transient state
- `ProjectsListPage` проверяет create + navigate
- `IdeaPage` проверяет form editing, modal state, delete confirm и несколько событий

Не стоит начинать с:

- `FlowEditorPage`
- `NodeConfigPanel`
- сложных debug/runtime widgets

## Критерии готовности self-hosting v1

Версия v1 готова, когда одновременно выполнены условия:

- экранные `.vue`-страницы не нужны для manifest-driven экранов
- UI-логика типовых экранов живёт в flow runtime
- external widgets подключаются через wrapper model
- runtime умеет собирать route/layout/page composition напрямую из manifests
- schema, IR и validate описывают фактический runtime contract
- migration tooling больше не диктует архитектурные решения

## Главные риски

- сохранить generated `.vue` как неявную целевую модель
- начать тащить сложные widgets в базовый DSL
- недооценить важность screen runtime и пытаться решить всё одним codegen
- сохранить две равноправные модели логики: `actions` и `flow`
- продолжать измерять успех главным образом через parity, а не через честный runtime contract

## Принцип принятия решений

Если сценарий относится к универсальному orchestration-уровню экрана, он должен выражаться через `ui manifest + flow manifest + runtime`.

Если сценарий относится к внутренней реализации сложного компонента, он должен жить во внешнем пакете и подключаться через wrapper contract.
